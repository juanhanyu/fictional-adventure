/* =========================================================================
   转生千金 · 角色语音清单 (js/voice-manifest.js)
   初始为空清单，确保未生成音频前 0 资源 404；语音管线构建后覆盖本文件。
   ========================================================================= */
(function (root) {
  'use strict';

  root.VOICE_MANIFEST = {
    version: 1,
    format: 'mp3',
    basePath: 'assets/voice/',
    totalFiles: 0,
    entries: {}
  };
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this));
