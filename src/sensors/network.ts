import CDP from "chrome-remote-interface";

export type CapturedRequest = {
  url: string;
  method: string;
  status?: number;
  isApi: boolean;
};

export type TelemetryReport = {
  networkRequests: CapturedRequest[];
  domMutations: string[];
  navigationOccurred: boolean;
  newUrl?: string;
  toastMessages: string[];
  pageTitle?: string;
  errors: string[];
};

export class TelemetryCapture {
  private session: CDP.Client;
  
  private requests = new Map<string, CapturedRequest>();
  private toastMessages: string[] = [];
  private errors: string[] = [];
  private navigationOccurred = false;
  private newUrl?: string;
  
  private active = false;

  constructor(session: CDP.Client) {
    this.session = session;
    this.setupListeners();
  }

  private setupListeners() {
    this.session.Network.requestWillBeSent((params) => {
      if (!this.active) return;
      this.requests.set(params.requestId, {
        url: params.request.url,
        method: params.request.method,
        isApi: params.request.url.includes('/api/') || params.request.headers['Accept']?.includes('application/json')
      });
    });

    this.session.Network.responseReceived((params) => {
      if (!this.active) return;
      const req = this.requests.get(params.requestId);
      if (req) {
        req.status = params.response.status;
        if (params.response.mimeType.includes('application/json')) {
          req.isApi = true;
        }
      }
    });

    this.session.Page.frameNavigated((params) => {
      if (!this.active) return;
      if (!params.frame.parentId) { // Main frame
        this.navigationOccurred = true;
        this.newUrl = params.frame.url;
      }
    });

    this.session.DOM.childNodeInserted((params) => {
      if (!this.active) return;
      // Simple heuristic for toasts: check nodeName or attributes if available
      // This requires resolving the node or just checking if it looks like a toast in a more complex setup
      // For now, if we get nodeName and it has classes like toast/alert, we could catch it.
      // A full implementation might query attributes of params.node.
      const attrs = params.node.attributes || [];
      const isToast = attrs.some(a => typeof a === 'string' && a.toLowerCase().match(/toast|snackbar|notification|alert/));
      if (isToast) {
         // Would need DOM.resolveNode and Runtime.callFunctionOn to get text, skipping for brevity
         this.toastMessages.push("Toast or banner detected");
      }
    });

    this.session.Runtime.consoleAPICalled((params) => {
      if (!this.active) return;
      if (params.type === 'error' || params.type === 'warning') {
        const text = params.args.map(a => a.value || a.description).join(' ');
        this.errors.push(`[${params.type}] ${text}`);
      }
    });
  }

  public async start(): Promise<void> {
    this.requests.clear();
    this.toastMessages = [];
    this.errors = [];
    this.navigationOccurred = false;
    this.newUrl = undefined;
    
    await this.session.Network.enable();
    await this.session.Page.enable();
    await this.session.DOM.enable();
    await this.session.Runtime.enable();
    
    this.active = true;
  }

  public async stop(): Promise<TelemetryReport> {
    this.active = false;
    
    return {
      networkRequests: Array.from(this.requests.values()),
      domMutations: this.toastMessages.length > 0 ? ["Toasts appeared"] : [], // simplified DOM mutations for now
      navigationOccurred: this.navigationOccurred,
      newUrl: this.newUrl,
      toastMessages: this.toastMessages,
      errors: this.errors
    };
  }
}
