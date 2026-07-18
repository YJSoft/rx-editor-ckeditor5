@php

/**
 * CKEditor 5 skin configuration for Rhymix.
 *
 * @author YJSoft <yjsoft@yjsoft.xyz>
 * @license GPL-2.0-or-later
 */

// 라이선스가 있는 경우 아래 GPL 부분을 실제 라이선스 키로 수정해주세요.
$ckeditor5_license = 'GPL';

// 이 아래부터는 수정하지 말아주세요.
$ckeditor5_sequence = (int)($editor_sequence ?? 0);
$_ckeditor5_upload_info = $_SESSION['upload_info'][$ckeditor5_sequence] ?? null;
$_ckeditor5_module_info = isset($module_info) && is_object($module_info)
    ? $module_info
    : Context::get('current_module_info');

$ckeditor5_colorset = in_array(($colorset ?? 'auto'), ['auto', 'light', 'dark'], true)
    ? $colorset
    : 'auto';
$ckeditor5_language = str_replace('jp', 'ja', (string)Context::getLangType());
if (!in_array($ckeditor5_language, ['ko', 'ja', 'en'], true)) {
    $ckeditor5_language = 'en';
}

$ckeditor5_default_font = (string)($content_font ?: 'default');
$ckeditor5_default_font_size = max(8, (int)preg_replace('/\D/', '', (string)($content_font_size ?? '13')));
$ckeditor5_fonts = array_values(array_filter(array_map('strval', $lang->edit->fontlist ?? [])));
if ($ckeditor5_default_font !== 'default' && !in_array($ckeditor5_default_font, $ckeditor5_fonts, true)) {
    array_unshift($ckeditor5_fonts, $ckeditor5_default_font);
}

$ckeditor5_font_options = ['default'];
foreach ($ckeditor5_fonts as $_ckeditor5_font) {
    $_ckeditor5_font_label = trim(array_first(explode(',', $_ckeditor5_font, 2)));
    $ckeditor5_font_options[] = $_ckeditor5_font_label . '/' . $_ckeditor5_font;
}
$ckeditor5_font_sizes = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 36, 40, 48];
if (!in_array($ckeditor5_default_font_size, $ckeditor5_font_sizes, true)) {
    $ckeditor5_font_sizes[] = $ckeditor5_default_font_size;
    sort($ckeditor5_font_sizes);
}

$ckeditor5_components = [];
foreach ($component_list ?? [] as $_ckeditor5_component_name => $_ckeditor5_component) {
    $ckeditor5_components[(string)$_ckeditor5_component_name] = escape($_ckeditor5_component->title, false);
}

$ckeditor5_config = [
    'license' => $ckeditor5_license,
    'editorSequence' => $ckeditor5_sequence,
    'primaryKeyName' => (string)($editor_primary_key_name ?? 'document_srl'),
    'contentKeyName' => (string)($editor_content_key_name ?? 'content'),
    'height' => max(100, (int)($editor_height ?? 300)),
    'toolbar' => (string)($editor_toolbar ?? 'default'),
    'hideToolbar' => (bool)($editor_toolbar_hide ?? false),
    'focus' => (bool)($editor_focus ?? false),
    'allowUpload' => (bool)($allow_fileupload ?? false),
    'allowHtml' => (bool)($html_mode ?? false),
    'enableAutosave' => (bool)($enable_autosave ?? false),
    'enableComponent' => (bool)($enable_component ?? false),
    'enableDefaultComponent' => (bool)($enable_default_component ?? false),
    'components' => $ckeditor5_components,
    'colorset' => $ckeditor5_colorset,
    'language' => $ckeditor5_language,
    'fontFamily' => $ckeditor5_font_options,
    'fontSize' => $ckeditor5_font_sizes,
    'defaultFont' => $ckeditor5_default_font,
    'defaultFontSize' => $ckeditor5_default_font_size,
    'moduleSrl' => (int)(is_object($_ckeditor5_upload_info)
        ? ($_ckeditor5_upload_info->module_srl ?? 0)
        : (is_object($_ckeditor5_module_info) ? ($_ckeditor5_module_info->module_srl ?? 0) : 0)),
    'uploadTargetSrl' => (int)(is_object($_ckeditor5_upload_info)
        ? ($_ckeditor5_upload_info->upload_target_srl ?? 0)
        : ($document_srl ?? ($upload_target_srl ?? 0))),
    'mid' => (string)($mid ?? (is_object($_ckeditor5_module_info) ? ($_ckeditor5_module_info->mid ?? '') : (Context::get('mid') ?? ''))),
    'csrfToken' => (string)(Context::get('_rx_csrf_token') ?? ''),
];

$ckeditor5_config_json = json_encode(
    $ckeditor5_config,
    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
);

$ckeditor5_css_vars = (object)[
    'content_font' => $content_font ?: 'inherit',
    'content_font_size' => $content_font_size ?: '13px',
    'content_line_height' => $content_line_height ?: 'normal',
    'content_word_break' => $content_word_break ?: 'normal',
    'content_paragraph_spacing' => $content_paragraph_spacing ?: '0',
];

unset(
    $_ckeditor5_upload_info,
    $_ckeditor5_module_info,
    $_ckeditor5_font,
    $_ckeditor5_font_label,
    $_ckeditor5_component,
    $_ckeditor5_component_name
);

@endphp
