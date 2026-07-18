/**
 * Browser smoke tests for the Rhymix CKEditor 5 adapter.
 *
 * @author YJSoft <yjsoft@yjsoft.xyz>
 * @license GPL-2.0-or-later
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const bundlePath = new URL('../dist/ckeditor5.js', import.meta.url).pathname;
const stylesheetPath = new URL("../dist/ckeditor5.css", import.meta.url).pathname;
const bundleSource = readFileSync(bundlePath, 'utf8');
const stylesheetSource = readFileSync(stylesheetPath, 'utf8');
const skinSource = readFileSync(new URL("../css/rhymix.scss", import.meta.url), "utf8");
const toolbarLayoutStyles = skinSource.match(/\/\* Toolbar toggle layout: start \*\/([\s\S]*?)\/\* Toolbar toggle layout: end \*\//)?.[1] || "";
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

for (const output of [bundleSource, stylesheetSource]) {
    assert.doesNotMatch(output, /ck-powered-by/);
    assert.doesNotMatch(output, /powered-by-ckeditor/);
}

function editorConfig(overrides = {}) {
    return {
        editorSequence: 101,
        primaryKeyName: 'document_srl',
        contentKeyName: 'content',
        height: 180,
        toolbar: 'default',
        hideToolbar: false,
        focus: false,
        allowUpload: true,
        allowHtml: true,
        enableAutosave: false,
        enableComponent: true,
        enableDefaultComponent: true,
        components: { emoticon: 'Emoticon', image_link: 'Image properties' },
        colorset: 'light',
        language: 'ko',
        fontFamily: ['default', 'Arial/Arial, sans-serif'],
        fontSize: [11, 13, 16],
        moduleSrl: 1,
        uploadTargetSrl: 11,
        mid: 'test',
        csrfToken: 'token',
        ...overrides,
    };
}

async function injectEditor(page) {
    await page.addStyleTag({ path: stylesheetPath });
    await page.addStyleTag({ content: toolbarLayoutStyles });
    await page.addScriptTag({ path: bundlePath, type: 'module' });
}

async function waitForEditor(page, sequence) {
    await page.waitForFunction(
        editorSequence => window.CKEditor5RhymixRegistry?.[editorSequence]?.editor,
        sequence,
        { timeout: 20000 },
    );
}

function collectErrors(page) {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
    });
    return errors;
}

async function assertToolbarToggleInside(page, expectedHidden) {
    const geometry = await page.evaluate(() => {
        const wrapper = document.querySelector(".rx-ckeditor5");
        const button = wrapper.querySelector(".rx-ckeditor5__toolbar-toggle");
        const wrapperRect = wrapper.getBoundingClientRect();
        const buttonRect = button.getBoundingClientRect();
        return {
            hidden: wrapper.classList.contains("rx-ckeditor5--toolbar-hidden"),
            wrapper: { top: wrapperRect.top, right: wrapperRect.right, bottom: wrapperRect.bottom, left: wrapperRect.left },
            button: { top: buttonRect.top, right: buttonRect.right, bottom: buttonRect.bottom, left: buttonRect.left },
        };
    });
    const tolerance = 0.5;
    assert.equal(geometry.hidden, expectedHidden);
    assert.ok(geometry.button.top >= geometry.wrapper.top - tolerance);
    assert.ok(geometry.button.right <= geometry.wrapper.right + tolerance);
    assert.ok(geometry.button.bottom <= geometry.wrapper.bottom + tolerance);
    assert.ok(geometry.button.left >= geometry.wrapper.left - tolerance);
}

async function testCoreAndComponents() {
    const page = await browser.newPage({ viewport: { width: 2200, height: 1200 } });
    const errors = collectErrors(page);
    await page.setContent(`<!doctype html><html><body>
        <form id="form101"><input name="document_srl" value="11"><textarea name="content"></textarea><input name="title" value="Title"><div id="ckeditor5_instance_101" class="rx-ckeditor5" data-editor-sequence="101"><div class="rx-ckeditor5__loading"></div><div class="rx-ckeditor5__source"></div></div></form>
        <form id="form102"><input name="comment_srl" value="22"><textarea name="comment_content"></textarea><div id="ckeditor5_instance_102" class="rx-ckeditor5" data-editor-sequence="102"><div class="rx-ckeditor5__loading"></div><div class="rx-ckeditor5__source"></div></div></form>
    </body></html>`);
    await page.evaluate(configs => {
        window.editorRelKeys = [];
        window.editorReplaceHTML = () => {
            throw new Error('Legacy editorReplaceHTML fallback called');
        };
        window.__componentCalls = [];
        window.openComponent = (name, sequence) => {
            window.__componentCalls.push({ name, sequence, nodeName: window.editorPrevNode?.nodeName || '' });
            if (window.editorPrevNode) window.editorPrevNode.setAttribute('data-component-edited', 'yes');
        };
        document.querySelector('#ckeditor5_instance_101').setAttribute('data-editor-config', JSON.stringify(configs.first));
        document.querySelector('#ckeditor5_instance_102').setAttribute('data-editor-config', JSON.stringify(configs.second));
        document.querySelector('#form101 textarea').value = '<p>Initial 101</p>';
        document.querySelector('#form102 textarea').value = '<p>Initial 102</p>';
    }, {
        first: editorConfig(),
        second: editorConfig({
            editorSequence: 102,
            primaryKeyName: 'comment_srl',
            contentKeyName: 'comment_content',
            toolbar: 'simple',
            language: 'ja',
            allowUpload: false,
            allowHtml: false,
        }),
    });
    await injectEditor(page);
    await Promise.all([waitForEditor(page, 101), waitForEditor(page, 102)]);

    const initial = await page.evaluate(() => ({
        first: window._getCkeInstance(101).getData(),
        second: window._getCkeInstance(102).getData(),
        useEditor: document.querySelector('#form101 [name=use_editor]').value,
        useHtml: document.querySelector('#form101 [name=use_html]').value,
        firstToolbar: window.CKEditor5RhymixRegistry[101].editor.config.get('toolbar.items'),
        secondToolbar: window.CKEditor5RhymixRegistry[102].editor.config.get('toolbar.items'),
        buttonTexts: Array.from(document.querySelectorAll("#ckeditor5_instance_101 .ck-toolbar button")).map(button => button.textContent.trim()).filter(Boolean),
        groupedDropdowns: document.querySelectorAll("#ckeditor5_instance_101 .ck-toolbar__grouped-dropdown").length,
    }));
    assert.match(initial.first, /Initial 101/);
    assert.match(initial.second, /Initial 102/);
    assert.equal(initial.useEditor, 'Y');
    assert.equal(initial.useHtml, 'Y');
    assert.ok(initial.firstToolbar.includes('sourceEditing'));
    assert.ok(initial.firstToolbar.includes('uploadImage'));
    assert.ok(initial.firstToolbar.includes('rhymixComponent:emoticon'));
    assert.deepEqual(initial.firstToolbar.slice(0, 5), ["sourceEditing", "|", "undo", "redo", "|"]);
    assert.deepEqual(initial.secondToolbar.slice(0, 3), ["fontFamily", "fontSize", "|"]);
    assert.equal(initial.groupedDropdowns, 0);
    assert.ok(initial.buttonTexts.some(text => text.includes("소스")));
    assert.ok(initial.buttonTexts.some(text => text.includes("Emoticon")));
    assert.ok(!initial.secondToolbar.includes('sourceEditing'));
    assert.ok(!initial.secondToolbar.includes('uploadImage'));

    await page.evaluate(() => {
        window._getCkeInstance(101).setData("<p><img src=\"/sample.png\" editor_component=\"image_link\" data-file-srl=\"77\" alt=\"before\"></p>");
    });

    await page.evaluate(() => {
        window.editorPrevSrl = 101;
        const frame = window.editorGetIFrame(window.editorPrevSrl);
        window.editorReplaceHTML(frame, '<p><span editor_component="emoticon" data-popup-insert="frame">frame component</span></p>');
        window.editorReplaceHTML(document.createElement('div'), '<p><img src="/poll.png" poll_srl="123" editor_component="poll_maker"></p>');
    });

    await page.evaluate(() => {
        window._getCkeInstance(101).insertHtml("<p><span editor_component=\"emoticon\" data-test=\"kept\">component</span></p>");
        document.querySelector("#form101").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await page.waitForTimeout(50);
    const synced = await page.evaluate(() => ({
        data: window._getCkeInstance(101).getData(),
        field: document.querySelector("#form101 textarea").value,
        second: window._getCkeInstance(102).getData(),
    }));
    assert.equal(synced.field, synced.data);
    assert.match(synced.data, /editor_component="image_link"/);
    assert.match(synced.data, /data-file-srl="77"/);
    assert.match(synced.data, /data-test="kept"/);
    assert.match(synced.data, /data-popup-insert="frame"/);
    assert.match(synced.data, /poll_srl="123"/);
    assert.match(synced.second, /Initial 102/);
    const cleaned = await page.evaluate(() => {
        window._getCkeInstance(101).setData("<figure class=\"image\"><br data-cke-filler=\"true\"></figure><p>kept</p>");
        return { data: window._getCkeInstance(101).getData(), field: document.querySelector("#form101 textarea").value };
    });
    assert.doesNotMatch(cleaned.data, /<figure class="image"/);
    assert.match(cleaned.data, /<p>kept<\/p>/);
    assert.equal(cleaned.field, cleaned.data);
    assert.deepEqual(errors, []);
    await page.close();
}

async function testComponentEditing() {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.setContent("<form><input name=\"document_srl\" value=\"44\"><textarea name=\"content\"></textarea><div class=\"rx-ckeditor5\" data-editor-sequence=\"401\"><div class=\"rx-ckeditor5__loading\"></div><div class=\"rx-ckeditor5__source\"></div></div></form>");
    await page.evaluate(config => {
        window.editorRelKeys = [];
        window.openComponent = (name, sequence) => {
            window.__editCall = { name, sequence, nodeName: window.editorPrevNode?.nodeName || "" };
            if (window.editorPrevNode) window.editorPrevNode.setAttribute("data-component-edited", "yes");
        };
        document.querySelector(".rx-ckeditor5").setAttribute("data-editor-config", JSON.stringify(config));
        document.querySelector("textarea").value = "<p><img src=\"/before.png\" editor_component=\"image_link\" data-file-srl=\"44\" alt=\"before\"></p>";
    }, editorConfig({ editorSequence: 401, allowUpload: false, components: { image_link: "Image properties" } }));
    await injectEditor(page);
    await waitForEditor(page, 401);
    await page.locator(".ck-content img").dblclick();
    await page.waitForFunction(() => window._getCkeInstance(401).getData().includes("data-component-edited"));
    const result = await page.evaluate(() => ({ call: window.__editCall, data: window._getCkeInstance(401).getData(), field: document.querySelector("textarea").value }));
    assert.deepEqual(result.call, { name: "image_link", sequence: 401, nodeName: "IMG" });
    assert.match(result.data, /data-component-edited="yes"/);
    assert.match(result.data, /editor_component="image_link"/);
    assert.match(result.data, /data-file-srl="44"/);
    assert.equal(result.field, result.data);
    assert.deepEqual(errors, []);
    await page.close();
}

async function testEnglishAndUpload() {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    let uploadRequest = null;
    await page.route('https://rhymix.test/**', async route => {
        const request = route.request();
        if (request.url().endsWith('/upload')) {
            uploadRequest = {
                headers: request.headers(),
                body: (request.postDataBuffer() || Buffer.alloc(0)).toString('latin1'),
            };
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    error: 0,
                    file_srl: 987,
                    upload_target_srl: 555,
                    source_filename: 'test.png',
                    download_url: '/files/test.png?x=1&amp;y=2',
                    mime_type: 'image/png',
                    width: 1,
                    height: 1,
                }),
            });
        } else {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<form><input name="document_srl" value="555"><textarea name="content"></textarea><div class="rx-ckeditor5" data-editor-sequence="301"><div class="rx-ckeditor5__loading"></div><div class="rx-ckeditor5__source"></div></div></form>',
            });
        }
    });
    await page.goto('https://rhymix.test/');
    await page.evaluate(config => {
        window.editorRelKeys = [];
        window.request_uri = '/upload';
        document.querySelector('.rx-ckeditor5').setAttribute('data-editor-config', JSON.stringify(config));
    }, editorConfig({
        editorSequence: 301,
        language: 'en',
        toolbar: 'simple',
        enableComponent: false,
        components: {},
        moduleSrl: 123,
        uploadTargetSrl: 555,
        mid: 'board',
        csrfToken: 'csrf-test',
    }));
    await injectEditor(page);
    await waitForEditor(page, 301);
    await page.evaluate(() => {
        const binary = atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
        const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
        const file = new File([bytes], 'test.png', { type: 'image/png' });
        window.CKEditor5RhymixRegistry[301].editor.execute('uploadImage', { file });
    });
    await page.waitForFunction(() => window._getCkeInstance(301).getData().includes('data-file-srl'));
    const data = await page.evaluate(() => window._getCkeInstance(301).getData());
    assert.ok(uploadRequest);
    assert.match(uploadRequest.headers['content-type'], /^multipart\/form-data; boundary=/);
    for (const expected of ['procFileUpload', 'editor_sequence', '301', 'module_srl', '123', 'upload_target_srl', '555', '_rx_csrf_token', 'csrf-test', 'Filedata', 'test.png']) {
        assert.match(uploadRequest.body, new RegExp(expected));
    }
    assert.match(data, /src="\/files\/test\.png\?x=1&amp;y=2"/);
    assert.match(data, /data-file-srl="987"/);
    assert.match(data, /editor_component="image_link"/);
    assert.deepEqual(errors, []);
    await page.close();
}

async function testAutosaveRestore() {
    const page = await browser.newPage();
    const errors = collectErrors(page);
    await page.setContent('<form id="saved"><input name="document_srl" value="1"><input name="title" value="Current"><textarea name="content">current</textarea><input name="_saved_doc_title" value="Saved title"><input name="_saved_doc_content" value="&lt;p&gt;Saved content&lt;/p&gt;"><input name="_saved_doc_message" value="Restore?"><div class="rx-ckeditor5" data-editor-sequence="501"><div class="rx-ckeditor5__loading"></div><div class="rx-ckeditor5__source"></div></div></form>');
    await page.evaluate(config => {
        window.editorRelKeys = [];
        window.current_mid = 'board';
        window.confirm = () => true;
        window.exec_json = (action, params, callback) => {
            window.__jsonCall = { action, params };
            callback({ document_srl: 999 });
        };
        window.reloadUploader = sequence => { window.__reloadCall = sequence; };
        window.editorEnableAutoSave = (form, sequence) => { window.__autosaveCall = { formId: form.id, sequence }; };
        document.querySelector('.rx-ckeditor5').setAttribute('data-editor-config', JSON.stringify(config));
    }, editorConfig({
        editorSequence: 501,
        language: 'en',
        toolbar: 'simple',
        hideToolbar: true,
        allowUpload: false,
        allowHtml: false,
        enableAutosave: true,
        enableComponent: false,
        components: {},
    }));
    await injectEditor(page);
    await waitForEditor(page, 501);
    const result = await page.evaluate(() => ({
        data: window._getCkeInstance(501).getData(),
        title: document.querySelector('[name=title]').value,
        primary: document.querySelector('[name=document_srl]').value,
        jsonCall: window.__jsonCall,
        reloadCall: window.__reloadCall,
        autosaveCall: window.__autosaveCall,
        toolbarHidden: document.querySelector('.rx-ckeditor5').classList.contains('rx-ckeditor5--toolbar-hidden'),
    }));
    assert.match(result.data, /Saved content/);
    assert.equal(result.title, 'Saved title');
    assert.equal(result.primary, '999');
    assert.equal(result.jsonCall.action, 'editor.procEditorLoadSavedDocument');
    assert.equal(result.reloadCall, 501);
    assert.deepEqual(result.autosaveCall, { formId: 'saved', sequence: 501 });
    assert.equal(result.toolbarHidden, true);
    await assertToolbarToggleInside(page, true);
    await page.locator(".rx-ckeditor5__toolbar-toggle").click();
    await assertToolbarToggleInside(page, false);
    assert.deepEqual(errors, []);
    await page.close();
}

async function testToolbarToggleMobile() {
    const page = await browser.newPage({ viewport: { width: 360, height: 740 } });
    const errors = collectErrors(page);
    await page.setContent("<form><input name=\"document_srl\"><textarea name=\"content\"></textarea><div class=\"rx-ckeditor5\" data-editor-sequence=\"601\"><div class=\"rx-ckeditor5__loading\"></div><div class=\"rx-ckeditor5__source\"></div></div></form>");
    await page.evaluate(config => {
        window.editorRelKeys = [];
        document.querySelector(".rx-ckeditor5").setAttribute("data-editor-config", JSON.stringify(config));
    }, editorConfig({ editorSequence: 601, toolbar: "simple", hideToolbar: true, allowUpload: false, allowHtml: true, enableComponent: false, components: {} }));
    await injectEditor(page);
    await waitForEditor(page, 601);
    await assertToolbarToggleInside(page, true);
    await page.locator(".rx-ckeditor5__toolbar-toggle").click();
    await assertToolbarToggleInside(page, false);
    assert.deepEqual(errors, []);
    await page.close();
}

try {
    await testCoreAndComponents();
    await testComponentEditing();
    await testEnglishAndUpload();
    await testAutosaveRestore();
    await testToolbarToggleMobile();
    console.log('CKEditor 5 Rhymix browser tests: OK');
} finally {
    await browser.close();
}
