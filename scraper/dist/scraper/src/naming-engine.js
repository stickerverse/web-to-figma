export class DeveloperNamingEngine {
    usedNamesGlobal = new Set();
    componentPatterns = new Map();
    semanticTags = new Set();
    interactiveTags = new Set();
    ariaRoleMap = new Map();
    constructor() {
        this.initializePatterns();
        this.initializeSemanticTags();
        this.initializeInteractiveTags();
        this.initializeAriaRoleMap();
    }
    /**
     * Generate a developer-friendly name for a node
     */
    generateName(nodeInfo, context = this.createDefaultContext()) {
        const baseName = this.generateBaseName(nodeInfo);
        const contextualName = this.addContextualPrefix(baseName, nodeInfo, context);
        const uniqueName = this.ensureUniqueness(contextualName, context);
        return this.toCamelCase(uniqueName);
    }
    /**
     * Create a default naming context
     */
    createDefaultContext() {
        return {
            ancestorNames: [],
            usedNames: new Set(),
            componentScope: "page",
        };
    }
    /**
     * Update context with a new scope
     */
    createScopedContext(parentContext, scopeName) {
        return {
            ancestorNames: [...parentContext.ancestorNames, scopeName],
            usedNames: new Set(),
            componentScope: scopeName,
        };
    }
    /**
     * Generate the base semantic name for a node
     */
    generateBaseName(nodeInfo) {
        // Priority order for naming sources
        const namingSources = [
            () => this.getAriaBasedName(nodeInfo),
            () => this.getTestIdName(nodeInfo),
            () => this.getIdBasedName(nodeInfo),
            () => this.getComponentPatternName(nodeInfo),
            () => this.getSemanticTagName(nodeInfo),
            () => this.getClassBasedName(nodeInfo),
            () => this.getContentBasedName(nodeInfo),
            () => this.getAttributeBasedName(nodeInfo),
            () => this.getFallbackName(nodeInfo),
        ];
        for (const source of namingSources) {
            const name = source();
            if (name)
                return name;
        }
        return "element";
    }
    /**
     * Get name based on ARIA attributes
     */
    getAriaBasedName(nodeInfo) {
        if (nodeInfo.role && this.ariaRoleMap.has(nodeInfo.role)) {
            const mappedName = this.ariaRoleMap.get(nodeInfo.role);
            // Add text hint for labeled elements
            if (nodeInfo.ariaLabel) {
                const textHint = this.extractTextHint(nodeInfo.ariaLabel);
                return textHint
                    ? `${textHint}${this.capitalize(mappedName)}`
                    : mappedName;
            }
            return mappedName;
        }
        if (nodeInfo.ariaLabel) {
            const textHint = this.extractTextHint(nodeInfo.ariaLabel);
            return textHint ? `${textHint}Element` : null;
        }
        return null;
    }
    /**
     * Get name based on data-testid attribute
     */
    getTestIdName(nodeInfo) {
        if (nodeInfo.dataTestId) {
            return this.cleanAttributeValue(nodeInfo.dataTestId);
        }
        return null;
    }
    /**
     * Get name based on id attribute
     */
    getIdBasedName(nodeInfo) {
        if (nodeInfo.id) {
            return this.cleanAttributeValue(nodeInfo.id);
        }
        return null;
    }
    /**
     * Detect component patterns and generate appropriate names
     */
    getComponentPatternName(nodeInfo) {
        const classNames = nodeInfo.className || "";
        for (const [pattern, regex] of this.componentPatterns) {
            if (regex.test(classNames)) {
                const textHint = this.getTextHint(nodeInfo);
                return textHint ? `${textHint}${this.capitalize(pattern)}` : pattern;
            }
        }
        // Special handling for common patterns
        if (this.isHeroSection(nodeInfo)) {
            return "heroSection";
        }
        if (this.isCard(nodeInfo)) {
            const textHint = this.getTextHint(nodeInfo);
            return textHint ? `${textHint}Card` : "card";
        }
        if (this.isModal(nodeInfo)) {
            const textHint = this.getTextHint(nodeInfo);
            return textHint ? `${textHint}Modal` : "modal";
        }
        return null;
    }
    /**
     * Get name based on semantic HTML tag
     */
    getSemanticTagName(nodeInfo) {
        if (this.semanticTags.has(nodeInfo.tagName.toLowerCase())) {
            const tagName = nodeInfo.tagName.toLowerCase();
            // Special handling for interactive elements
            if (this.interactiveTags.has(tagName)) {
                const textHint = this.getTextHint(nodeInfo);
                if (tagName === "button") {
                    return textHint ? `${textHint}Button` : "button";
                }
                if (tagName === "a") {
                    return textHint ? `${textHint}Link` : "link";
                }
                if (tagName === "input") {
                    const inputType = nodeInfo.type || "text";
                    const placeholderHint = nodeInfo.placeholder
                        ? this.extractTextHint(nodeInfo.placeholder)
                        : textHint;
                    return placeholderHint
                        ? `${placeholderHint}${this.capitalize(inputType)}Input`
                        : `${inputType}Input`;
                }
            }
            // Handle headings with content
            if (/^h[1-6]$/.test(tagName)) {
                const textHint = this.getTextHint(nodeInfo);
                return textHint ? `${textHint}Heading` : "heading";
            }
            return tagName;
        }
        return null;
    }
    /**
     * Get name based on CSS classes
     */
    getClassBasedName(nodeInfo) {
        if (!nodeInfo.className)
            return null;
        const classes = nodeInfo.className.split(/\s+/);
        const meaningfulClass = classes.find((cls) => cls.length > 2 &&
            !cls.startsWith("css-") &&
            !cls.match(/^[a-z]\d+$/) &&
            !cls.includes("__"));
        if (meaningfulClass) {
            return this.cleanAttributeValue(meaningfulClass);
        }
        return null;
    }
    /**
     * Get name based on text content
     */
    getContentBasedName(nodeInfo) {
        const textHint = this.getTextHint(nodeInfo);
        if (textHint) {
            const tagBasedSuffix = this.getTagBasedSuffix(nodeInfo.tagName);
            return `${textHint}${tagBasedSuffix}`;
        }
        return null;
    }
    /**
     * Get name based on other attributes
     */
    getAttributeBasedName(nodeInfo) {
        // Handle images
        if (nodeInfo.tagName.toLowerCase() === "img") {
            if (nodeInfo.alt) {
                const textHint = this.extractTextHint(nodeInfo.alt);
                return textHint ? `${textHint}Image` : "image";
            }
            if (nodeInfo.src) {
                const filename = nodeInfo.src.split("/").pop()?.split(".")[0];
                if (filename && filename.length > 2) {
                    return `${this.cleanAttributeValue(filename)}Image`;
                }
            }
            return "image";
        }
        // Handle links
        if (nodeInfo.tagName.toLowerCase() === "a" && nodeInfo.href) {
            const textHint = this.getTextHint(nodeInfo);
            return textHint ? `${textHint}Link` : "link";
        }
        return null;
    }
    /**
     * Generate fallback name
     */
    getFallbackName(nodeInfo) {
        const tagName = nodeInfo.tagName.toLowerCase();
        return this.getTagBasedSuffix(tagName).toLowerCase() || "element";
    }
    /**
     * Add contextual prefix to name
     */
    addContextualPrefix(baseName, nodeInfo, context) {
        // Add sibling differentiation
        if (nodeInfo.siblingIndex !== undefined &&
            nodeInfo.totalSiblings !== undefined &&
            nodeInfo.totalSiblings > 1) {
            // Only add index for middle items or when there are many siblings
            if (nodeInfo.totalSiblings > 3 ||
                (nodeInfo.siblingIndex > 0 &&
                    nodeInfo.siblingIndex < nodeInfo.totalSiblings - 1)) {
                return `${baseName}${nodeInfo.siblingIndex + 1}`;
            }
            // For first/last of few siblings
            if (nodeInfo.siblingIndex === 0 && nodeInfo.totalSiblings <= 3) {
                return `first${this.capitalize(baseName)}`;
            }
            if (nodeInfo.siblingIndex === nodeInfo.totalSiblings - 1 &&
                nodeInfo.totalSiblings <= 3) {
                return `last${this.capitalize(baseName)}`;
            }
        }
        return baseName;
    }
    /**
     * Ensure name uniqueness within context
     */
    ensureUniqueness(name, context) {
        let uniqueName = name;
        let counter = 1;
        while (context.usedNames.has(uniqueName) ||
            this.usedNamesGlobal.has(uniqueName)) {
            uniqueName = `${name}${counter}`;
            counter++;
        }
        context.usedNames.add(uniqueName);
        this.usedNamesGlobal.add(uniqueName);
        return uniqueName;
    }
    /**
     * Extract text hint from text content
     */
    getTextHint(nodeInfo) {
        const sources = [
            nodeInfo.ariaLabel,
            nodeInfo.title,
            nodeInfo.placeholder,
            nodeInfo.alt,
            nodeInfo.textContent,
        ];
        for (const source of sources) {
            if (source) {
                const hint = this.extractTextHint(source);
                if (hint)
                    return hint;
            }
        }
        return "";
    }
    /**
     * Extract meaningful text hint from string
     */
    extractTextHint(text) {
        if (!text || text.length < 2)
            return "";
        // Clean and normalize text
        const cleaned = text
            .replace(/[^\w\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        // Split into words and filter meaningful ones
        const words = cleaned
            .split(" ")
            .filter((word) => word.length > 1)
            .filter((word) => !this.isStopWord(word))
            .slice(0, 2); // Take max 2 words
        if (words.length === 0)
            return "";
        // Join words and clean
        return words.map((word) => this.capitalize(word.toLowerCase())).join("");
    }
    /**
     * Get tag-based suffix for elements
     */
    getTagBasedSuffix(tagName) {
        const suffixMap = {
            div: "Container",
            span: "Text",
            p: "Paragraph",
            button: "Button",
            input: "Input",
            select: "Select",
            textarea: "Textarea",
            form: "Form",
            table: "Table",
            ul: "List",
            ol: "List",
            li: "Item",
            img: "Image",
            a: "Link",
            nav: "Navigation",
            header: "Header",
            footer: "Footer",
            main: "Main",
            aside: "Sidebar",
            section: "Section",
            article: "Article",
        };
        return suffixMap[tagName.toLowerCase()] || "Element";
    }
    /**
     * Convert string to camelCase
     */
    toCamelCase(str) {
        return str
            .replace(/[^a-zA-Z0-9]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .split(" ")
            .map((word, index) => index === 0 ? word.toLowerCase() : this.capitalize(word.toLowerCase()))
            .join("");
    }
    /**
     * Capitalize first letter
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    /**
     * Clean attribute value for use in names
     */
    cleanAttributeValue(value) {
        return value
            .replace(/[^a-zA-Z0-9\-_]/g, " ")
            .replace(/[\-_]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }
    /**
     * Check if word is a stop word
     */
    isStopWord(word) {
        const stopWords = new Set([
            "the",
            "a",
            "an",
            "and",
            "or",
            "but",
            "in",
            "on",
            "at",
            "to",
            "for",
            "of",
            "with",
            "by",
            "click",
            "here",
            "this",
            "that",
            "these",
            "those",
            "is",
            "are",
            "was",
            "were",
            "be",
            "been",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
        ]);
        return stopWords.has(word.toLowerCase());
    }
    /**
     * Detect if element is a hero section
     */
    isHeroSection(nodeInfo) {
        const className = nodeInfo.className || "";
        return (/hero|banner|jumbotron|intro/i.test(className) &&
            nodeInfo.tagName.toLowerCase() === "section");
    }
    /**
     * Detect if element is a card
     */
    isCard(nodeInfo) {
        const className = nodeInfo.className || "";
        return /card|tile|item/i.test(className);
    }
    /**
     * Detect if element is a modal
     */
    isModal(nodeInfo) {
        const className = nodeInfo.className || "";
        const role = nodeInfo.role || "";
        return /modal|dialog|popup|overlay/i.test(className) || role === "dialog";
    }
    /**
     * Initialize component patterns
     */
    initializePatterns() {
        this.componentPatterns.set("button", /btn|button/i);
        this.componentPatterns.set("card", /card|tile|item/i);
        this.componentPatterns.set("modal", /modal|dialog|popup/i);
        this.componentPatterns.set("dropdown", /dropdown|select|menu/i);
        this.componentPatterns.set("navigation", /nav|menu|breadcrumb/i);
        this.componentPatterns.set("form", /form|input|field/i);
        this.componentPatterns.set("list", /list|grid|table/i);
        this.componentPatterns.set("header", /header|top|title/i);
        this.componentPatterns.set("footer", /footer|bottom/i);
        this.componentPatterns.set("sidebar", /sidebar|aside|side/i);
        this.componentPatterns.set("content", /content|main|body/i);
        this.componentPatterns.set("container", /container|wrapper|box/i);
    }
    /**
     * Initialize semantic HTML tags
     */
    initializeSemanticTags() {
        this.semanticTags = new Set([
            "header",
            "nav",
            "main",
            "section",
            "article",
            "aside",
            "footer",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "button",
            "a",
            "input",
            "select",
            "textarea",
            "form",
            "table",
            "thead",
            "tbody",
            "tr",
            "th",
            "td",
            "ul",
            "ol",
            "li",
            "dl",
            "dt",
            "dd",
            "figure",
            "figcaption",
            "img",
            "video",
            "audio",
            "details",
            "summary",
            "dialog",
        ]);
    }
    /**
     * Initialize interactive HTML tags
     */
    initializeInteractiveTags() {
        this.interactiveTags = new Set([
            "a",
            "button",
            "input",
            "select",
            "textarea",
            "details",
            "summary",
        ]);
    }
    /**
     * Initialize ARIA role mappings
     */
    initializeAriaRoleMap() {
        this.ariaRoleMap.set("button", "button");
        this.ariaRoleMap.set("link", "link");
        this.ariaRoleMap.set("navigation", "navigation");
        this.ariaRoleMap.set("banner", "banner");
        this.ariaRoleMap.set("main", "main");
        this.ariaRoleMap.set("complementary", "sidebar");
        this.ariaRoleMap.set("contentinfo", "footer");
        this.ariaRoleMap.set("search", "search");
        this.ariaRoleMap.set("form", "form");
        this.ariaRoleMap.set("dialog", "modal");
        this.ariaRoleMap.set("alertdialog", "alertModal");
        this.ariaRoleMap.set("menu", "menu");
        this.ariaRoleMap.set("menuitem", "menuItem");
        this.ariaRoleMap.set("tab", "tab");
        this.ariaRoleMap.set("tabpanel", "tabPanel");
        this.ariaRoleMap.set("list", "list");
        this.ariaRoleMap.set("listitem", "listItem");
        this.ariaRoleMap.set("table", "table");
        this.ariaRoleMap.set("row", "row");
        this.ariaRoleMap.set("cell", "cell");
        this.ariaRoleMap.set("columnheader", "columnHeader");
        this.ariaRoleMap.set("rowheader", "rowHeader");
        this.ariaRoleMap.set("textbox", "textbox");
        this.ariaRoleMap.set("checkbox", "checkbox");
        this.ariaRoleMap.set("radio", "radio");
        this.ariaRoleMap.set("slider", "slider");
        this.ariaRoleMap.set("progressbar", "progressBar");
        this.ariaRoleMap.set("alert", "alert");
        this.ariaRoleMap.set("status", "status");
    }
    /**
     * Reset global state (useful for testing)
     */
    resetGlobalState() {
        this.usedNamesGlobal.clear();
    }
    /**
     * Get statistics about naming patterns
     */
    getStats() {
        return {
            totalNamesGenerated: this.usedNamesGlobal.size,
            componentPatternsDetected: this.componentPatterns.size,
            semanticTagsUsed: this.semanticTags.size,
        };
    }
}
/**
 * Factory function to create a new naming engine instance
 */
export function createNamingEngine() {
    return new DeveloperNamingEngine();
}
/**
 * Utility function to extract node information from DOM element
 */
export function extractNodeInfo(element) {
    return {
        tagName: element.tagName,
        className: element.className || undefined,
        id: element.id || undefined,
        textContent: element.textContent?.trim() || undefined,
        role: element.getAttribute("role") || undefined,
        type: element.getAttribute("type") || undefined,
        href: element.getAttribute("href") || undefined,
        src: element.getAttribute("src") || undefined,
        alt: element.getAttribute("alt") || undefined,
        title: element.getAttribute("title") || undefined,
        placeholder: element.getAttribute("placeholder") || undefined,
        value: element.getAttribute("value") || undefined,
        ariaLabel: element.getAttribute("aria-label") || undefined,
        ariaDescribedBy: element.getAttribute("aria-describedby") || undefined,
        dataTestId: element.getAttribute("data-testid") || undefined,
        parentTagName: element.parentElement?.tagName || undefined,
    };
}
//# sourceMappingURL=naming-engine.js.map