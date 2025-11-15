import { WebSocket } from 'ws';
import type { IRNode } from '../../ir.js';
export interface StreamPayload {
    nodes: IRNode[];
    fonts?: any[];
    tokens?: any;
    stackingContexts?: any[];
    paintOrder?: string[];
}
export declare class StreamController {
    private readonly ws;
    private sequenceNumber;
    private readonly imageProcessor;
    private totalNodes;
    constructor(ws: WebSocket);
    streamExtractedPage(payload: StreamPayload): Promise<void>;
    private attachImageSources;
    private processAllImages;
    private streamNodes;
    private streamImageChunks;
    private cloneForTransport;
    private sendComplete;
    private sendProgress;
    private sendError;
    private send;
    private sleep;
}
//# sourceMappingURL=stream-controller.d.ts.map