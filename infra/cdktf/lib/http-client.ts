export interface HttpRequestOptions {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string | object;
  timeout?: number;
}

export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  text: string;
}

export class HttpClient {
  private static async makeRequest(options: HttpRequestOptions): Promise<HttpResponse> {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      timeout = 30000
    } = options;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const requestOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        signal: controller.signal
      };

      if (body) {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      const response = await fetch(url, requestOptions);
      
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const text = await response.text();
      let data: any;
      
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
        text
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  static async get(url: string, options?: Omit<HttpRequestOptions, 'url' | 'method'>): Promise<HttpResponse> {
    return this.makeRequest({ url, method: 'GET', ...options });
  }

  static async post(url: string, options?: Omit<HttpRequestOptions, 'url' | 'method'>): Promise<HttpResponse> {
    return this.makeRequest({ url, method: 'POST', ...options });
  }

  static async put(url: string, options?: Omit<HttpRequestOptions, 'url' | 'method'>): Promise<HttpResponse> {
    return this.makeRequest({ url, method: 'PUT', ...options });
  }

  static async delete(url: string, options?: Omit<HttpRequestOptions, 'url' | 'method'>): Promise<HttpResponse> {
    return this.makeRequest({ url, method: 'DELETE', ...options });
  }

  static async patch(url: string, options?: Omit<HttpRequestOptions, 'url' | 'method'>): Promise<HttpResponse> {
    return this.makeRequest({ url, method: 'PATCH', ...options });
  }
} 