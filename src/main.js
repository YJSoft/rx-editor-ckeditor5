/**
 * CKEditor 5 adapter for Rhymix.
 *
 * @author YJSoft <yjsoft@yjsoft.xyz>
 * @license GPL-2.0-or-later
 */

import {
    Alignment,
    Autoformat,
    AutoLink,
    BlockQuote,
    Bold,
    ButtonView,
    ClassicEditor,
    Code,
    CodeBlock,
    Essentials,
    FindAndReplace,
    FontBackgroundColor,
    FontColor,
    FontFamily,
    FontSize,
    GeneralHtmlSupport,
    Heading,
    HorizontalLine,
    Image,
    ImageCaption,
    ImageInsertViaUrl,
    ImageResize,
    ImageStyle,
    ImageToolbar,
    ImageUpload,
    Indent,
    IndentBlock,
    Italic,
    Link,
    LinkImage,
    List,
    ListProperties,
    MediaEmbed,
    Paragraph,
    PasteFromOffice,
    Plugin,
    RemoveFormat,
    SelectAll,
    SourceEditing,
    Strikethrough,
    Subscript,
    Superscript,
    Table,
    TableCellProperties,
    TableProperties,
    TableToolbar,
    Underline,
} from 'ckeditor5';
import koTranslations from 'ckeditor5/translations/ko.js';
import jaTranslations from 'ckeditor5/translations/ja.js';
import 'ckeditor5/ckeditor5.css';

const registry = window.CKEditor5RhymixRegistry = window.CKEditor5RhymixRegistry || Object.create(null);
const componentIcon = '<svg viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M4 2h5v5H4V2Zm7 0h5v5h-5V2ZM4 9h5v5H4V9Zm7 0h5v5h-5V9ZM7 16h6v2H7v-2Z"/></svg>';

class RhymixComponents extends Plugin {
    static get pluginName() {
        return 'RhymixComponents';
    }

    init() {
        const editor = this.editor;
        const components = editor.config.get('rhymix.components') || {};

        Object.entries(components).forEach(([name, title]) => {
            editor.ui.componentFactory.add(componentToolbarName(name), locale => {
                const button = new ButtonView(locale);
                button.set({
                    label: String(title || name),
                    icon: componentIcon,
                    tooltip: true,
                    withText: true,
                });
                button.on('execute', () => openRhymixComponent(editor, name));
                return button;
            });
        });
    }
}

class RhymixUploadAdapter {
    constructor(loader, bridge) {
        this.loader = loader;
        this.bridge = bridge;
        this.xhr = null;
    }

    upload() {
        return this.loader.file.then(file => new Promise((resolve, reject) => {
            const xhr = this.xhr = new XMLHttpRequest();
            const formData = new FormData();
            const config = this.bridge.config;

            xhr.open('POST', window.request_uri || window.location.pathname || '/', true);
            xhr.responseType = 'json';
            xhr.withCredentials = true;
            xhr.addEventListener('error', () => reject(uploadErrorMessage()));
            xhr.addEventListener('abort', () => reject());
            xhr.addEventListener('load', () => {
                let response = xhr.response;
                if (!response && xhr.responseText) {
                    try {
                        response = JSON.parse(xhr.responseText);
                    } catch (error) {
                        reject(uploadErrorMessage(xhr.responseText));
                        return;
                    }
                }
                if (!response || Number(response.error) !== 0 || !response.download_url) {
                    reject(response && response.message ? response.message : uploadErrorMessage());
                    return;
                }

                this.bridge.lastUpload = response;
                refreshUploader(this.bridge.sequence, response);
                resolve({
                    default: normalizeRhymixUrl(response.download_url),
                    rhymix: response,
                });
            });

            if (xhr.upload) {
                xhr.upload.addEventListener('progress', event => {
                    if (!event.lengthComputable) return;
                    this.loader.uploadTotal = event.total;
                    this.loader.uploaded = event.loaded;
                });
            }

            formData.append('act', 'procFileUpload');
            formData.append('editor_sequence', String(this.bridge.sequence));
            formData.append('Filedata', file);
            if (config.mid) formData.append('mid', config.mid);
            if (config.moduleSrl) formData.append('module_srl', String(config.moduleSrl));
            if (config.uploadTargetSrl) formData.append('upload_target_srl', String(config.uploadTargetSrl));
            if (config.csrfToken) formData.append('_rx_csrf_token', config.csrfToken);
            xhr.send(formData);
        }));
    }

    abort() {
        if (this.xhr) this.xhr.abort();
    }
}

function componentToolbarName(name) {
    return `rhymixComponent:${name}`;
}

function normalizeSequence(value) {
    const sequence = Number.parseInt(value, 10);
    return Number.isFinite(sequence) ? sequence : 0;
}

function normalizeRhymixUrl(value) {
    return String(value || '').replace(/&(?:amp|#0*38|#x0*26);/gi, '&');
}

function uploadErrorMessage(detail = '') {
    let message = 'File upload failed.';
    if (window.Rhymix && typeof window.Rhymix.lang === 'function') {
        message = window.Rhymix.lang('msg_file_upload_error') || message;
    }
    return detail ? `${message}\n${detail}` : message;
}

function readConfig(wrapper) {
    try {
        return JSON.parse(wrapper.getAttribute('data-editor-config') || '{}');
    } catch (error) {
        throw new Error(`Invalid CKEditor 5 configuration: ${error.message}`);
    }
}

function findNamedControl(form, name) {
    if (!form || !name) return null;
    const controls = Array.from(form.elements || []);
    return controls.find(control => control.name === name) || null;
}

function ensureHiddenField(form, name, value) {
    let input = findNamedControl(form, name);
    if (!input) {
        input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        form.appendChild(input);
    }
    input.value = value;
    return input;
}

function getTranslations(language) {
    if (language === 'ko') return [koTranslations];
    if (language === 'ja') return [jaTranslations];
    return [];
}
function createToolbar(config) {
    if (!config.enableDefaultComponent) return [];

    const simple = [
        "fontFamily", "fontSize", "|",
        "bold", "italic", "underline", "strikethrough", "fontColor", "fontBackgroundColor", "|",
        "alignment", "|",
        "link", "insertImageViaUrl", "insertTable",
    ];
    const full = [
        "undo", "redo", "|",
        "findAndReplace", "selectAll", "|",
        "bold", "italic", "underline", "strikethrough", "subscript", "superscript", "code", "removeFormat", "|",
        "bulletedList", "numberedList", "outdent", "indent", "blockQuote", "alignment", "|",
        "link", "insertImageViaUrl", "insertTable", "mediaEmbed", "horizontalLine", "codeBlock", "|",
        "heading", "fontFamily", "fontSize", "|",
        "fontColor", "fontBackgroundColor",
    ];
    const items = config.toolbar === "simple" ? simple : full;

    if (config.allowUpload) {
        const imageIndex = items.indexOf("insertImageViaUrl");
        items.splice(imageIndex + 1, 0, "uploadImage");
    }
    if (config.enableComponent) {
        const components = Object.keys(config.components || {});
        if (components.length) items.push("|", ...components.map(componentToolbarName));
    }
    if (config.allowHtml) {
        if (config.toolbar === "simple") items.push("|", "sourceEditing");
        else items.unshift("sourceEditing", "|");
    }
    return items;
}

function createEditorConfig(config, initialData) {
    const editorConfig = {
        licenseKey: 'GPL',
        initialData,
        language: config.language || 'en',
        plugins: [
            Essentials,
            Autoformat,
            Paragraph,
            Heading,
            Bold,
            Italic,
            Underline,
            Strikethrough,
            Subscript,
            Superscript,
            Code,
            FontFamily,
            FontSize,
            FontColor,
            FontBackgroundColor,
            Alignment,
            List,
            ListProperties,
            Indent,
            IndentBlock,
            Link,
            AutoLink,
            LinkImage,
            BlockQuote,
            Image,
            ImageCaption,
            ImageStyle,
            ImageResize,
            ImageToolbar,
            ImageUpload,
            ImageInsertViaUrl,
            Table,
            TableToolbar,
            TableProperties,
            TableCellProperties,
            MediaEmbed,
            CodeBlock,
            HorizontalLine,
            RemoveFormat,
            SourceEditing,
            GeneralHtmlSupport,
            PasteFromOffice,
            FindAndReplace,
            SelectAll,
            RhymixComponents,
        ],
        toolbar: {
            items: createToolbar(config),
            shouldNotGroupWhenFull: true,
        },
        heading: {
            options: [
                { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                { model: 'heading1', view: 'h2', title: 'Heading 1', class: 'ck-heading_heading1' },
                { model: 'heading2', view: 'h3', title: 'Heading 2', class: 'ck-heading_heading2' },
                { model: 'heading3', view: 'h4', title: 'Heading 3', class: 'ck-heading_heading3' },
            ],
        },
        fontFamily: {
            options: Array.isArray(config.fontFamily) && config.fontFamily.length ? config.fontFamily : ['default'],
            supportAllValues: true,
        },
        fontSize: {
            options: Array.isArray(config.fontSize) && config.fontSize.length ? config.fontSize : [9, 11, 13, 'default', 17, 19, 21],
            supportAllValues: true,
        },
        image: {
            toolbar: [
                'imageTextAlternative',
                'toggleImageCaption',
                '|',
                'imageStyle:inline',
                'imageStyle:wrapText',
                'imageStyle:breakText',
                '|',
                'resizeImage',
            ],
        },
        table: {
            contentToolbar: [
                'tableColumn',
                'tableRow',
                'mergeTableCells',
                'tableProperties',
                'tableCellProperties',
            ],
        },
        list: {
            properties: {
                styles: true,
                startIndex: true,
                reversed: true,
            },
        },
        link: {
            addTargetToExternalLinks: true,
            defaultProtocol: 'https://',
        },
        mediaEmbed: {
            previewsInData: true,
        },
        htmlSupport: {
            allow: [
                {
                    name: /^(?:a|abbr|address|article|aside|audio|b|bdi|bdo|big|caption|center|cite|col|colgroup|dd|del|details|dfn|div|dl|dt|em|figcaption|figure|font|footer|header|hgroup|i|img|ins|kbd|main|mark|nav|picture|pre|q|rp|rt|ruby|s|samp|section|small|source|span|strike|strong|sub|summary|sup|time|track|tt|u|var|video|wbr)$/,
                    attributes: /^(?!on)[a-z][\w:.-]*$/i,
                    classes: true,
                    styles: true,
                },
                {
                    name: /^(?:p|h1|h2|h3|h4|h5|h6|blockquote|ol|ul|li|table|thead|tbody|tfoot|tr|th|td|hr)$/,
                    attributes: /^(?!on)[a-z][\w:.-]*$/i,
                    classes: true,
                    styles: true,
                },
            ],
            disallow: [
                { name: /^(?:script|style|iframe|object|embed|form|input|button|select|option|textarea)$/i },
                { attributes: [/^on/i, 'srcdoc', 'formaction'] },
            ],
        },
        rhymix: {
            components: config.enableComponent ? (config.components || {}) : {},
        },
    };
    const translations = getTranslations(config.language);
    if (translations.length) editorConfig.translations = translations;
    return editorConfig;
}

function restoreSavedDocument(bridge) {
    const form = bridge.form;
    const savedTitle = findNamedControl(form, '_saved_doc_title');
    const savedContent = findNamedControl(form, '_saved_doc_content');
    const savedMessage = findNamedControl(form, '_saved_doc_message');
    if (!savedTitle || !savedContent || (!savedTitle.value && !savedContent.value)) {
        return bridge.contentInput.value || '';
    }

    if (!window.confirm(savedMessage ? savedMessage.value : 'Load the autosaved document?')) {
        if (typeof window.editorRemoveSavedDoc === 'function') window.editorRemoveSavedDoc();
        return bridge.contentInput.value || '';
    }

    const titleInput = findNamedControl(form, 'title');
    if (titleInput) titleInput.value = savedTitle.value;

    if (typeof window.exec_json === 'function') {
        window.exec_json('editor.procEditorLoadSavedDocument', {
            editor_sequence: bridge.sequence,
            primary_key: bridge.config.primaryKeyName,
            mid: window.current_mid || bridge.config.mid || '',
        }, response => {
            if (response && response.document_srl && bridge.primaryInput) {
                bridge.primaryInput.value = response.document_srl;
            }
            if (typeof window.reloadUploader === 'function') window.reloadUploader(bridge.sequence);
        });
    }
    return savedContent.value;
}

function installUploadAdapter(editor, bridge) {
    if (!bridge.config.allowUpload) return;
    const repository = editor.plugins.get('FileRepository');
    repository.createUploadAdapter = loader => new RhymixUploadAdapter(loader, bridge);

    const imageUploadEditing = editor.plugins.get('ImageUploadEditing');
    imageUploadEditing.on('uploadComplete', (event, { data, imageElement }) => {
        const response = data && data.rhymix ? data.rhymix : bridge.lastUpload;
        if (!response || !response.file_srl || !imageElement) return;
        editor.model.change(writer => {
            writer.setAttribute('htmlImgAttributes', {
                attributes: {
                    'data-file-srl': String(response.file_srl),
                    editor_component: 'image_link',
                },
            }, imageElement);
            if (!imageElement.hasAttribute('alt') && response.source_filename) {
                writer.setAttribute('alt', String(response.source_filename), imageElement);
            }
        });
    });
}

function refreshUploader(sequence, response, attempt = 0) {
    if (!window.jQuery) return;
    const container = window.jQuery("#xefu-container-" + sequence);
    if (!container.length) return;
    const instance = container.data("instance");
    if (instance && typeof instance.loadFilelist === "function") {
        container.data("editorStatus", response);
        instance.loadFilelist(container, true);
    } else if (attempt < 20) {
        window.setTimeout(() => refreshUploader(sequence, response, attempt + 1), 100);
    }
}

function htmlToModel(editor, html) {
    const viewFragment = editor.data.processor.toView(String(html || ''));
    return editor.data.toModel(viewFragment);
}

function insertHtml(bridge, html) {
    if (!bridge.editor) return;
    const fragment = htmlToModel(bridge.editor, html);
    bridge.editor.model.insertContent(fragment);
    bridge.sync();
}

function selectedHtml(editor) {
    const fragment = editor.model.getSelectedContent(editor.model.document.selection);
    const viewFragment = editor.data.toView(fragment);
    return editor.data.stringify(viewFragment);
}

function selectedText(editor) {
    const html = selectedHtml(editor);
    const element = document.createElement('div');
    element.innerHTML = html;
    return element.textContent || '';
}

function openRhymixComponent(editor, name) {
    const bridge = registry[normalizeSequence(editor.config.get('rhymix.editorSequence'))];
    if (!bridge || typeof window.openComponent !== 'function') return;
    window.editorPrevNode = null;
    editor.editing.view.focus();
    window.openComponent(name, bridge.sequence);
}

function closestComponentNode(target, editable) {
    if (!(target instanceof Element)) return null;
    const node = target.closest('[editor_component]');
    return node && editable.contains(node) ? node : null;
}

function createComponentProxyNode(original) {
    const nestedImage = original.matches("img") ? original : original.querySelector("img");
    if (!nestedImage) return original.cloneNode(true);

    const clone = nestedImage.cloneNode(true);
    Array.from(original.attributes).forEach(attribute => {
        const name = attribute.name.toLowerCase();
        if (["contenteditable", "draggable", "tabindex", "role"].includes(name) || name.startsWith("aria-") || name.startsWith("data-cke-")) return;
        if (name === "class") {
            const classes = attribute.value.split(/\s+/).filter(className => className && !className.startsWith("ck-") && !["image", "image-inline"].includes(className));
            if (classes.length) clone.classList.add(...classes);
            return;
        }
        clone.setAttribute(attribute.name, attribute.value);
    });
    return clone;
}

function modelElementFromDom(editor, domNode) {
    let viewNode = editor.editing.view.domConverter.domToView(domNode);
    while (viewNode) {
        const modelNode = editor.editing.mapper.toModelElement(viewNode);
        if (modelNode) return modelNode;
        viewNode = viewNode.parent;
    }
    return null;
}

function installComponentEditing(bridge) {
    if (!bridge.config.enableComponent) return;
    const editable = bridge.editable;
    editable.addEventListener('dblclick', event => {
        const original = closestComponentNode(event.target, editable);
        if (!original) return;
        const componentName = original.getAttribute('editor_component');
        if (!componentName || !Object.prototype.hasOwnProperty.call(bridge.config.components || {}, componentName)) return;

        const modelElement = modelElementFromDom(bridge.editor, original);
        if (!modelElement) return;
        event.preventDefault();
        event.stopPropagation();

        const holder = document.createElement('div');
        holder.className = 'rx-ckeditor5__component-proxy';
        holder.appendChild(createComponentProxyNode(original));
        bridge.wrapper.appendChild(holder);
        window.editorPrevNode = holder.firstElementChild;

        let queued = false;
        const observer = new MutationObserver(() => {
            if (queued || !modelElement.root) return;
            queued = true;
            queueMicrotask(() => {
                queued = false;
                if (!modelElement.root || !holder.isConnected) return;
                try {
                    const fragment = htmlToModel(bridge.editor, holder.innerHTML);
                    bridge.editor.model.change(writer => {
                        const position = writer.createPositionBefore(modelElement);
                        writer.remove(modelElement);
                        bridge.editor.model.insertContent(fragment, position);
                    });
                    bridge.sync();
                    observer.disconnect();
                    holder.remove();
                } catch (error) {
                    console.error('[CKEditor5/Rhymix] Component update failed.', error);
                }
            });
        });
        observer.observe(holder, { subtree: true, childList: true, attributes: true, characterData: true });

        bridge.editor.model.change(writer => writer.setSelection(modelElement, 'on'));
        window.openComponent(componentName, bridge.sequence);
        window.setTimeout(() => {
            if (!holder.isConnected) return;
            observer.disconnect();
            holder.remove();
            if (window.editorPrevNode && !window.editorPrevNode.isConnected) window.editorPrevNode = null;
        }, 30 * 60 * 1000);
    }, true);
}

function addToolbarToggle(bridge) {
    if (!bridge.config.enableDefaultComponent) {
        bridge.wrapper.classList.add('rx-ckeditor5--toolbar-hidden');
        return;
    }
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rx-ckeditor5__toolbar-toggle';
    button.setAttribute('aria-label', 'Toggle editor toolbar');
    button.setAttribute('aria-expanded', String(!bridge.config.hideToolbar));
    button.textContent = '≡';
    button.addEventListener('click', () => {
        const hidden = bridge.wrapper.classList.toggle('rx-ckeditor5--toolbar-hidden');
        button.setAttribute('aria-expanded', String(!hidden));
    });
    bridge.wrapper.appendChild(button);
    if (bridge.config.hideToolbar) bridge.wrapper.classList.add('rx-ckeditor5--toolbar-hidden');
}

function installGlobals() {
    if (window.CKEditor5RhymixGlobalsInstalled) return;
    window.CKEditor5RhymixGlobalsInstalled = true;

    const previous = {
        getInstance: window._getCkeInstance,
        getContainer: window._getCkeContainer,
        getFrame: window.editorGetIFrame,
        replaceHtml: window.editorReplaceHTML,
        getContent: window.editorGetContent,
        getText: window.editorGetContentTextarea_xe,
        getSelected: window.editorGetSelectedHtml,
    };

    window._getCkeInstance = sequence => {
        const bridge = registry[normalizeSequence(sequence)];
        return bridge ? bridge.compat : (typeof previous.getInstance === 'function' ? previous.getInstance(sequence) : undefined);
    };
    window._getCkeContainer = sequence => {
        const bridge = registry[normalizeSequence(sequence)];
        if (bridge) return window.jQuery ? window.jQuery(bridge.wrapper) : bridge.wrapper;
        return typeof previous.getContainer === 'function' ? previous.getContainer(sequence) : undefined;
    };
    window.editorGetIFrame = sequence => {
        const bridge = registry[normalizeSequence(sequence)];
        return bridge ? bridge.editable : (typeof previous.getFrame === 'function' ? previous.getFrame(sequence) : null);
    };
    window.editorReplaceHTML = (frame, html) => {
        const sequence = normalizeSequence(frame && (frame.dataset?.editorSequence || String(frame.id || '').replace(/^.*_/, '')));
        const bridge = registry[sequence];
        if (bridge) return bridge.compat.insertHtml(html, 'unfiltered_html');
        if (typeof previous.replaceHtml === 'function') return previous.replaceHtml(frame, html);
    };
    window.editorGetContent = sequence => {
        const bridge = registry[normalizeSequence(sequence)];
        if (bridge) return bridge.sync();
        return typeof previous.getContent === 'function' ? previous.getContent(sequence) : '';
    };
    window.editorGetContentTextarea_xe = sequence => {
        const bridge = registry[normalizeSequence(sequence)];
        if (bridge) return bridge.compat.getText();
        return typeof previous.getText === 'function' ? previous.getText(sequence) : '';
    };
    window.editorGetSelectedHtml = sequence => {
        const bridge = registry[normalizeSequence(sequence)];
        if (bridge) return selectedHtml(bridge.editor);
        return typeof previous.getSelected === 'function' ? previous.getSelected(sequence) : '';
    };
}

function removeEmptyImageFigures(html) {
    const template = document.createElement("template");
    template.innerHTML = String(html || "");
    template.content.querySelectorAll("figure.image").forEach(figure => {
        const media = figure.querySelector("img, picture, video, audio, table, iframe, object, embed");
        if (!media && !figure.textContent.trim()) figure.remove();
    });
    return template.innerHTML;
}

function createCompat(bridge) {
    return {
        mode: 'wysiwyg',
        getData: () => bridge.sync(),
        setData: html => {
            bridge.editor.setData(removeEmptyImageFigures(html));
            bridge.sync();
        },
        insertHtml: html => insertHtml(bridge, html),
        getText: () => {
            const element = document.createElement('div');
            element.innerHTML = bridge.editor.getData();
            return element.textContent || '';
        },
        getSelection: () => ({
            getSelectedText: () => selectedText(bridge.editor),
        }),
        focus: () => bridge.editor.editing.view.focus(),
    };
}

function showError(wrapper, error) {
    wrapper.classList.add('rx-ckeditor5--ready');
    const loading = wrapper.querySelector('.rx-ckeditor5__loading');
    if (loading) loading.remove();
    const source = wrapper.querySelector('.rx-ckeditor5__source');
    if (source) {
        source.className = 'rx-ckeditor5__error';
        source.textContent = `CKEditor 5 could not be initialized.\n${error.message || error}`;
    }
    console.error('[CKEditor5/Rhymix] Initialization failed.', error);
}

async function initialize(wrapper) {
    const config = readConfig(wrapper);
    const sequence = normalizeSequence(config.editorSequence || wrapper.dataset.editorSequence);
    const form = wrapper.closest('form');
    if (!sequence || !form) throw new Error('The editor sequence or parent form is missing.');

    const primaryInput = findNamedControl(form, config.primaryKeyName);
    const contentInput = findNamedControl(form, config.contentKeyName);
    if (!contentInput) throw new Error(`The Rhymix content field "${config.contentKeyName}" was not found.`);

    const bridge = {
        wrapper,
        form,
        config,
        sequence,
        primaryInput: primaryInput || { value: '' },
        contentInput,
        editor: null,
        editable: null,
        compat: null,
        lastUpload: null,
        sync() {
            if (this.editor) this.contentInput.value = this.editor.getData();
            return this.contentInput.value;
        },
    };
    registry[sequence] = bridge;

    form.setAttribute('editor_sequence', String(sequence));
    ensureHiddenField(form, 'use_editor', 'Y');
    ensureHiddenField(form, 'use_html', 'Y');
    const initialData = restoreSavedDocument(bridge);
    const source = wrapper.querySelector('.rx-ckeditor5__source');
    const editorConfig = createEditorConfig(config, initialData);
    editorConfig.rhymix.editorSequence = sequence;
    const editor = bridge.editor = await ClassicEditor.create(source, editorConfig);
    bridge.editable = editor.ui.getEditableElement();
    bridge.editable.dataset.editorSequence = String(sequence);
    bridge.editable.classList.add('rhymix_content', 'xe_content', 'editable');
    bridge.editable.setFocus = () => editor.editing.view.focus();
    bridge.compat = createCompat(bridge);

    installUploadAdapter(editor, bridge);
    installComponentEditing(bridge);
    installGlobals();
    addToolbarToggle(bridge);

    window.editorRelKeys = window.editorRelKeys || [];
    window.editorRelKeys[sequence] = {
        primary: bridge.primaryInput,
        content: contentInput,
        func: () => bridge.sync(),
        pasteHTML: html => insertHtml(bridge, html),
        editor: { getFrame: () => bridge.editable },
    };

    let syncQueued = false;
    editor.model.document.on('change:data', () => {
        if (syncQueued) return;
        syncQueued = true;
        queueMicrotask(() => {
            syncQueued = false;
            bridge.sync();
        });
    });
    form.addEventListener('submit', () => bridge.sync(), true);
    bridge.sync();

    if (config.enableAutosave && typeof window.editorEnableAutoSave === 'function') {
        window.editorEnableAutoSave(form, sequence);
    }
    wrapper.classList.add('rx-ckeditor5--ready');
    if (config.focus) editor.editing.view.focus();
}

function boot() {
    document.querySelectorAll('.rx-ckeditor5:not([data-ckeditor5-started])').forEach(wrapper => {
        wrapper.setAttribute('data-ckeditor5-started', 'true');
        initialize(wrapper).catch(error => showError(wrapper, error));
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}

window.addEventListener('pageshow', boot);
