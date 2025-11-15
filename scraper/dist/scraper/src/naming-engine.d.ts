export interface NodeInfo {
    tagName: string;
    className?: string;
    id?: string;
    textContent?: string;
    role?: string;
    type?: string;
    href?: string;
    src?: string;
    alt?: string;
    title?: string;
    placeholder?: string;
    value?: string;
    ariaLabel?: string;
    ariaDescribedBy?: string;
    dataTestId?: string;
    parentTagName?: string;
    siblingIndex?: number;
    totalSiblings?: number;
}
export interface NamingContext {
    ancestorNames: string[];
    usedNames: Set<string>;
    componentScope: string;
}
export declare class DeveloperNamingEngine {
    private usedNamesGlobal;
    private componentPatterns;
    private semanticTags;
    private interactiveTags;
    private ariaRoleMap;
    constructor();
    /**
     * Generate a developer-friendly name for a node
     */
    generateName(nodeInfo: NodeInfo, context?: NamingContext): string;
    /**
     * Create a default naming context
     */
    createDefaultContext(): NamingContext;
    /**
     * Update context with a new scope
     */
    createScopedContext(parentContext: NamingContext, scopeName: string): NamingContext;
    /**
     * Generate the base semantic name for a node
     */
    private generateBaseName;
    /**
     * Get name based on ARIA attributes
     */
    private getAriaBasedName;
    /**
     * Get name based on data-testid attribute
     */
    private getTestIdName;
    /**
     * Get name based on id attribute
     */
    private getIdBasedName;
    /**
     * Detect component patterns and generate appropriate names
     */
    private getComponentPatternName;
    /**
     * Get name based on semantic HTML tag
     */
    private getSemanticTagName;
    /**
     * Get name based on CSS classes
     */
    private getClassBasedName;
    /**
     * Get name based on text content
     */
    private getContentBasedName;
    /**
     * Get name based on other attributes
     */
    private getAttributeBasedName;
    /**
     * Generate fallback name
     */
    private getFallbackName;
    /**
     * Add contextual prefix to name
     */
    private addContextualPrefix;
    /**
     * Ensure name uniqueness within context
     */
    private ensureUniqueness;
    /**
     * Extract text hint from text content
     */
    private getTextHint;
    /**
     * Extract meaningful text hint from string
     */
    private extractTextHint;
    /**
     * Get tag-based suffix for elements
     */
    private getTagBasedSuffix;
    /**
     * Convert string to camelCase
     */
    private toCamelCase;
    /**
     * Capitalize first letter
     */
    private capitalize;
    /**
     * Clean attribute value for use in names
     */
    private cleanAttributeValue;
    /**
     * Check if word is a stop word
     */
    private isStopWord;
    /**
     * Detect if element is a hero section
     */
    private isHeroSection;
    /**
     * Detect if element is a card
     */
    private isCard;
    /**
     * Detect if element is a modal
     */
    private isModal;
    /**
     * Initialize component patterns
     */
    private initializePatterns;
    /**
     * Initialize semantic HTML tags
     */
    private initializeSemanticTags;
    /**
     * Initialize interactive HTML tags
     */
    private initializeInteractiveTags;
    /**
     * Initialize ARIA role mappings
     */
    private initializeAriaRoleMap;
    /**
     * Reset global state (useful for testing)
     */
    resetGlobalState(): void;
    /**
     * Get statistics about naming patterns
     */
    getStats(): {
        totalNamesGenerated: number;
        componentPatternsDetected: number;
        semanticTagsUsed: number;
    };
}
/**
 * Factory function to create a new naming engine instance
 */
export declare function createNamingEngine(): DeveloperNamingEngine;
/**
 * Utility function to extract node information from DOM element
 */
export declare function extractNodeInfo(element: Element): NodeInfo;
//# sourceMappingURL=naming-engine.d.ts.map