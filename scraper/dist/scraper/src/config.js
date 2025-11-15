import 'dotenv/config';
export const CONFIG = {
    IMAGE_SIZE_THRESHOLD: parseInt(process.env.IMAGE_SIZE_THRESHOLD || '102400', 10),
    IMAGE_CHUNK_SIZE: parseInt(process.env.IMAGE_CHUNK_SIZE || '65536', 10),
    IMAGE_TIMEOUT_MS: parseInt(process.env.IMAGE_TIMEOUT_MS || '15000', 10),
    IMAGE_ASSEMBLY_TIMEOUT_MS: parseInt(process.env.IMAGE_ASSEMBLY_TIMEOUT_MS || '30000', 10),
    MAX_CONCURRENT_IMAGES: parseInt(process.env.MAX_CONCURRENT_IMAGES || '5', 10),
    // Rendering Stability Layer Configuration
    FREEZE_LAYER_ENABLED: process.env.FREEZE_LAYER_ENABLED !== 'false', // Default: enabled
    FREEZE_DISABLE_ANIMATIONS: process.env.FREEZE_DISABLE_ANIMATIONS !== 'false', // Default: enabled
    FREEZE_DISABLE_SCROLL: process.env.FREEZE_DISABLE_SCROLL !== 'false', // Default: enabled
    FREEZE_DISABLE_TIMING: process.env.FREEZE_DISABLE_TIMING !== 'false', // Default: enabled
};
//# sourceMappingURL=config.js.map