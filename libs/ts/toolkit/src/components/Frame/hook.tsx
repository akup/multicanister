import { useState, useEffect } from 'react';
import { checkCertificatesFromURL } from '@validation-poc/certification';
import * as utils from '../../utils';

export interface FrameCheckResult {
  success: boolean;
  src: string;
  message: string;
}

export const useFrameCheck = (canisterId: string) => {
  const [result, setResult] = useState<FrameCheckResult | null>(null);

  useEffect(() => {
    (async () => {
      const timestamp = Date.now();
      const p = utils.checkPrincipal(canisterId);

      if (!p) {
        setResult({
          success: false,
          src: '',
          message: `Bad principal "${canisterId}"`,
        });
        return;
      }

      // if (utils.isLocalhost()) {
      if (utils.isLocalhost() && window.location.href.includes('localhost:8000')) {
        const src = `http://localhost:8000/entrypoint.html?canisterId=${canisterId}&timestamp=${timestamp}`;
        const success = await checkUrl(src);
        setResult({
          success,
          src,
          message: `Result of certificates check "${success}"`,
        });
        return;
      }

      // TODO отрефачить костыли локальной разработки (порты)
      if (utils.isLocalhost() && window.location.href.includes('localhost')) {
        // TODO костыль для локальной разработки, ищем порты локальных серверов
        const canisters = Object.values(discovery.env) as any[];
        const port = canisters.find(c => c.id == canisterId)?.port || -1;

        setResult({
          success: true,
          src: `http://localhost:${port}?timestamp=${timestamp}`,
          message: '',
        });
        return;
      }

      const src = `https://${canisterId}.raw.ic0.app/entrypoint.html`;
      const success = await checkUrl(src);

      setResult({
        success,
        src: `${src}?timestamp=${timestamp}`,
        message: `Result of certificates check "${success}"`,
      });
    })();
  }, []);

  return result;
};

export const checkUrl = async (src: string) => {
  const url = new URL(src);
  // https://github.com/dfinity/agent-js/pull/513
  const res = await checkCertificatesFromURL(url.toString()); // TODO FIXME временное решение, ждем фикса от dfinity и переделываем на fetch
  const resSW = await checkCertificatesFromURL(`${url.origin}/sw.js${url.search}`);

  // console.log('checkUrl', {res, resSW});
  return res.success && resSW.success;
};
