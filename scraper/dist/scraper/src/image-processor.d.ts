import type { IRNode, ImageSource } from '../../ir.js';
export interface ProcessingStats {
    totalImages: number;
    inlineImages: number;
    streamedImages: number;
    failedImages: number;
    totalBytesProcessed: number;
}
export declare class ImageProcessor {
    private stats;
    processImageForNode(node: IRNode & {
        imageSource?: ImageSource;
    }): Promise<{
        buffer: Buffer;
        shouldStream: boolean;
    } | null>;
    private fetchAndConvert;
    private fromDataUrl;
    private detectFormat;
    private detectFormatFromDataUrl;
    private convertIfNeeded;
    getStats(): ProcessingStats;
    resetStats(): void;
}
//# sourceMappingURL=image-processor.d.ts.map