(function () {
  'use strict';
  const code = '#小程序://小宝贝/6rgi3WZtRC9rX0v';
  let dialog;
  function open() {
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'mini-program-dialog';
      dialog.setAttribute('aria-labelledby', 'mini-program-title');
      dialog.innerHTML = '<h2 id="mini-program-title">打开小宝贝金算盘</h2><img class="mini-program-code" src="./assets/support-images/mini-program.png" alt="小宝贝金算盘微信小程序码"><p>用手机微信扫一扫上方小程序码即可打开。也可以复制下方小程序口令，粘贴到微信聊天中发送，再点击微信识别的小程序入口。</p><p>也可以在微信中搜索“小宝贝金算盘”。</p><textarea readonly aria-label="小程序口令"></textarea><p role="status" aria-live="polite"></p><div><button type="button" data-copy>复制小程序口令</button><button type="button" data-close>关闭</button></div>';
      dialog.querySelector('textarea').value = code;
      dialog.querySelector('[data-close]').onclick = () => dialog.close();
      dialog.querySelector('[data-copy]').onclick = async () => {
        const status = dialog.querySelector('[role="status"]');
        try {
          if (window.electronAPI?.copyMiniProgram) await window.electronAPI.copyMiniProgram();
          else {
            const input = dialog.querySelector('textarea'); input.focus(); input.select();
            if (!document.execCommand('copy')) {
              if (!navigator.clipboard?.writeText) throw new Error('复制失败');
              await navigator.clipboard.writeText(code);
            }
          }
          status.textContent = '口令已复制，请到微信中粘贴发送后打开。';
        } catch (_) { status.textContent = '复制失败，请选中上方口令，按 Ctrl+C 手动复制。'; }
      };
      document.body.append(dialog);
    }
    dialog.querySelector('[role="status"]').textContent = '';
    if (!dialog.open) dialog.showModal();
  }
  function connect() {
    document.querySelectorAll('#app span').forEach(span => {
      if (!span.textContent.includes('作者联系QQ') || !span.textContent.includes(code) || span.querySelector('button')) return;
      const text = span.textContent;
      const start = text.indexOf('小宝贝金算盘小程序：');
      if (start < 0) return;
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'mini-program-entry';
      button.textContent = '打开小宝贝金算盘'; button.onclick = open;
      span.replaceChildren(document.createTextNode(text.slice(0, start)), button, document.createTextNode(text.slice(start + '小宝贝金算盘小程序：'.length + code.length)));
    });
  }
  function init() {
    const style = document.createElement('style');
    style.textContent = '.mini-program-entry{color:inherit;font:inherit;text-decoration:underline;background:transparent;border:0;cursor:pointer;padding:0 4px}.mini-program-entry:focus-visible{outline:2px solid currentColor}.mini-program-dialog{width:460px;max-width:90vw;padding:24px;border:1px solid #777;border-radius:8px;background:#fff;color:#222;font:14px/1.7 "Microsoft YaHei",sans-serif}.mini-program-code{display:block;width:280px;max-width:100%;height:auto;margin:0 auto 12px}.mini-program-dialog{max-height:90vh;overflow:auto;box-sizing:border-box}.mini-program-dialog::backdrop{background:#0007}.mini-program-dialog h2{font-size:20px;margin:0 0 12px}.mini-program-dialog textarea{width:100%;box-sizing:border-box;resize:none;height:65px;font:inherit}.mini-program-dialog>div{display:flex;gap:12px;justify-content:flex-end}.mini-program-dialog button{padding:6px 14px;cursor:pointer}.mini-program-dialog [role=status]{min-height:24px}';
    document.head.append(style);
    connect();
    new MutationObserver(connect).observe(document.getElementById('app'), {childList:true, subtree:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
