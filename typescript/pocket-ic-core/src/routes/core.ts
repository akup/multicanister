import { Router, Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { CoreModel } from '~/models/CoreModel';
import crypto from 'crypto';
import fs from 'fs';
import { pocketICService } from '~/index';
import { CanisterStatus, UpdateStrategy } from '~/services/PocketICService';

const router = Router();
const coreModel = CoreModel.getInstance();

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (
    req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    const uploadDir = path.join(process.cwd(), 'ic-data', 'uploads');
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (
    req: Request,
    file: Express.Multer.File,
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
  file?: Express.Multer.File;
}

router.post('/upload', upload.single('file'), async (req: UploadRequest, res: Response) => {
  let uploadedFilePath: string | null = null;

  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    uploadedFilePath = req.file.path;

    let { name, sha256, branch, tag, commit, updateStrategy } = req.body;

    if (!branch) {
      branch = 'main';
      tag = 'latest';
      commit = 'latest';
    }
    if (!updateStrategy || !['upgrade', 'reinstall'].includes(updateStrategy)) {
      updateStrategy = 'upgrade' as UpdateStrategy;
    }

    if (!name || !sha256) {
      await cleanupUploadedFile(uploadedFilePath);
      return res.status(400).json({
        message: 'Missing required parameters',
        required: ['name', 'sha256'],
      });
    }

    // Calculate wasm hash
    const fileBuffer = await fs.promises.readFile(req.file.path);
    const wasmHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    //Compare the wasm hash
    if (sha256 !== wasmHash) {
      await cleanupUploadedFile(uploadedFilePath);
      return res.status(400).json({
        message: "Provided file's sha256 hash does not match the uploaded file",
        required: ['sha256'],
      });
    }

    var canisterStatus: CanisterStatus | undefined = undefined;
    const existingCanisterDetails = await coreModel.get(name);
    if (existingCanisterDetails && existingCanisterDetails.canisterIds.length > 0) {
      canisterStatus = await pocketICService.checkCanisterHashAndRunning(
        existingCanisterDetails.canisterIds[0],
        existingCanisterDetails.wasmHash
      );
      /*
      const canisterStatus = await pocketICService
        .getManagementCanisterAgent()
        ?.canisterStatus(Principal.fromText(existingCanisterDetails.canisterIds[0]));
      const deployedModuleHash = canisterStatus?.module_hash?.[0]
        ? Buffer.from(canisterStatus.module_hash[0]).toString('hex')
        : undefined;
      isCanisterCorrupted = deployedModuleHash !== existingCanisterDetails.wasmHash;
      */

      if (canisterStatus === 'running') {
        return res.status(200).json({
          message: 'Canister with same hash already exists and deployed',
        });
      }
    }

    // If canister wasm hash matches stored hash we upgrade the canister
    // If canister wasm hash does not match stored hash (corrupted) we use http parameter upgrade to define the install mode (default to upgrade)
    // If canister does not exist we install the canister
    const canisterId = await pocketICService.deployCanister({
      canisterId:
        existingCanisterDetails && existingCanisterDetails.canisterIds.length > 0
          ? existingCanisterDetails.canisterIds[0]
          : undefined,
      wasmPath: uploadedFilePath,
      wasmModuleHash: wasmHash,
      updateStrategy:
        canisterStatus === 'corrupted'
          ? (updateStrategy as UpdateStrategy)
          : existingCanisterDetails
            ? 'upgrade'
            : undefined,
    });

    // Create core record
    const coreRecord = {
      canisterIds: [canisterId],
      wasmHash,
      branch,
      tag,
      commit,
    };

    await coreModel.set(name, coreRecord);

    // Clean up the uploaded file after successful processing
    await cleanupUploadedFile(uploadedFilePath);

    res.json({
      message: 'File uploaded successfully',
      data: {
        name,
        wasmHash,
        branch,
        tag,
        commit,
      },
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    // Clean up the uploaded file in case of error
    if (uploadedFilePath) {
      await cleanupUploadedFile(uploadedFilePath);
    }

    res.status(500).json({
      message: 'Error uploading file',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Cleanup incomplete uploads on server start
const cleanupIncompleteUploads = async () => {
  const uploadDir = path.join(process.cwd(), 'ic-data', 'uploads');
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

export default router;
