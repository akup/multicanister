import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { CoreModel } from '../models/CoreModel';
import crypto from 'crypto';
import fs from 'fs';
import { pocketICService } from '../index';
import { UpdateStrategy } from '../services/PocketICService';
import { DATA_DIR } from '~/models/DataDir';

const router = Router();
const coreModel = CoreModel.getInstance();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (
    req: Request,
    file: globalThis.Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    const uploadDir = path.join(DATA_DIR, 'uploads');
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (
    req: Request,
    file: globalThis.Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Cleanup function for uploaded files
const cleanupUploadedFile = async (filePath: string): Promise<void> => {
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};

const upload = multer({ storage });

router.post('/get-canister-ids', async (req: Request, res: Response) => {
  try {
    const { names } = req.body;
    if (!Array.isArray(names) || names.length === 0) {
      return res.status(400).json({ message: 'Missing or invalid "names" array in request body' });
    }

    console.log('GET-CANISTER-IDS requested for names:', names);

    const canisterIds = await pocketICService.getCanisterIds(names);
    res.status(200).json(canisterIds);
  } catch (error) {
    res.status(500).json({
      message: 'Error ensuring canisters were created',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.get('/list-core', async (req: Request, res: Response) => {
  try {
    const cores = await coreModel.list();
    res.json(cores);
  } catch (error) {
    res.status(500).json({
      message: 'Error retrieving cores',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

interface UploadRequest extends Request {
  file?: globalThis.Express.Multer.File;
}

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  let uploadedFilePath: string | undefined = undefined;
  try {
    console.log('uploading file');
    if (!req.file) {
      return res.status(400).json({ message: 'No file in request' });
    }
    uploadedFilePath = req.file.path; // Get path from disk storage
    console.log('has file contents');

    let { name, sha256, branch, tag, commit, initArgB64 } = req.body;

    if (!branch) {
      branch = 'main';
      tag = 'latest';
      commit = 'latest';
    }

    const existingCanisterDetails = await coreModel.get(name);
    const isFirstInstall = !existingCanisterDetails?.wasmHash;
    const updateStrategy: UpdateStrategy = isFirstInstall ? 'reinstall' : 'upgrade';

    console.log(`Determined strategy: '${updateStrategy}' for canister '${name}'`);

    if (!name || !sha256) {
      return res.status(400).json({
        message: 'Missing required parameters',
        required: ['name', 'sha256'],
      });
    }

    // Read file from temporary path to get the buffer
    const fileBuffer = await fs.promises.readFile(uploadedFilePath);
    const wasmHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    if (sha256 !== wasmHash) {
      return res.status(400).json({
        message: "Provided file's sha256 hash does not match the uploaded file",
      });
    }

    console.log('File sha256 hash matches');

    if (!existingCanisterDetails || existingCanisterDetails.canisterIds.length === 0) {
      return res.status(404).json({
        message: `Canister '${name}' not found. It must be created first via /get-canister-ids.`,
      });
    }

    const canisterId = existingCanisterDetails.canisterIds[0];

    const canisterStatus = await pocketICService.checkCanisterHashAndRunning(
      canisterId,
      existingCanisterDetails.wasmHash
    );

    if (canisterStatus === 'running' && existingCanisterDetails.wasmHash === wasmHash) {
      return res.status(200).json({
        message: 'Canister with same hash already exists and deployed',
        data: existingCanisterDetails,
      });
    }

    await pocketICService.installCode({
      canisterId: canisterId,
      wasmModule: fileBuffer, // Use the buffer read from the file
      wasmModuleHash: wasmHash,
      initArgB64,
      updateStrategy:
        // canisterStatus === 'corrupted' ? (updateStrategy as UpdateStrategy) : 'upgrade',     // temporary disabling, look beforehand
        updateStrategy,
    });

    const coreRecord = {
      canisterIds: [canisterId],
      wasmHash,
      branch,
      tag,
      commit,
      corrupted: false,
    };

    await coreModel.set(name, coreRecord);

    res.json({
      message: 'File uploaded and code installed successfully',
      data: coreRecord,
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      message: 'Error uploading file',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    // Ensure the temporary file is always cleaned up
    if (uploadedFilePath) {
      cleanupUploadedFile(uploadedFilePath);
    }
  }
});

// Cleanup incomplete uploads on server start
const cleanupIncompleteUploads = async (): Promise<void> => {
  const uploadDir = path.join(DATA_DIR, 'uploads');
  if (fs.existsSync(uploadDir)) {
    const files = await fs.promises.readdir(uploadDir);
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      await cleanupUploadedFile(filePath);
    }
  }
};

// Run cleanup on server start
cleanupIncompleteUploads().catch(console.error);

export { router as coreRoutes };
