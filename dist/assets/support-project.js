(function (root) {
  'use strict';
  const MINI_PROGRAM = '#小程序://小宝贝/6rgi3WZtRC9rX0v';
  let page;
  function hide() { if (page) page.hidden = true; }
  function close() {
    hide();
    document.getElementById('app').hidden = false;
    root.projectNavigation?.select('accounting');
  }
  function open() {
    if (!page) create();
    root.ringProject?.hide();
    document.getElementById('app').hidden = true;
    page.hidden = false;
    root.projectNavigation?.select('support');
  }
  function create() {
    page = document.createElement('section');
    page.id = 'support-project';
    page.setAttribute('aria-label', '联系与支持');
    page.innerHTML = `<header class="support-header"><div class="support-app-identity"><img src="./assets/app-icon.png" alt="小宝贝记账本图标"><div><h1>联系与支持 <small>小宝贝记账本</small></h1><p>有任何使用问题、反馈或者建议，欢迎通过微信联系我。</p></div></div><button type="button" data-action="back">返回五开记账</button></header>
      <main class="support-main"><div class="support-intro"><div><h2>你的反馈，让记账本更好用</h2><p>使用中遇到问题，或者希望增加新功能，可以扫码加我微信告诉我。请简单描述问题和使用场景，我会认真看。</p></div><p>如果这个小工具对你有帮助，也欢迎自愿打赏，支持后续维护与更新。感谢你的使用和支持。</p></div>
      <div class="support-cards">
      <article class="support-card"><div class="support-card-head"><span class="support-badge">联系作者</span><h3>微信二维码</h3><p>扫码添加微信，交流反馈与建议</p></div><button class="support-qr" type="button" data-action="zoom" data-image="wechat-contact.png" aria-label="放大微信二维码"><img src="./assets/support-images/wechat-contact.png" alt="作者微信好友二维码"></button><p class="support-card-foot">微信昵称：满山猴子我腚最红</p></article>
      <article class="support-card"><div class="support-card-head"><span class="support-badge support-badge-pay">自愿支持</span><h3>微信打赏</h3><p>微信扫一扫，按心意支持维护</p></div><button class="support-qr" type="button" data-action="zoom" data-image="wechat-pay.png" aria-label="放大微信收款码"><img src="./assets/support-images/wechat-pay.png" alt="作者微信收款码"></button><p class="support-card-foot">打赏完全自愿，不影响软件使用。</p></article>
      <article class="support-card"><div class="support-card-head"><span class="support-badge support-badge-pay">自愿支持</span><h3>支付宝打赏</h3><p>支付宝扫一扫，按心意支持维护</p></div><button class="support-qr" type="button" data-action="zoom" data-image="alipay-pay.jpg" aria-label="放大支付宝收款码"><img src="./assets/support-images/alipay-pay.jpg" alt="作者支付宝收款码"></button><p class="support-card-foot">感谢每一份鼓励与建议。</p></article>
      </div><div class="support-mini"><div><strong>小宝贝金算盘</strong><p>微信小程序入口：<span id="support-mini-link">${MINI_PROGRAM}</span></p></div><button type="button" data-action="copy">复制小程序链接</button></div><p class="support-status" role="status" aria-live="polite"></p></main>
      <dialog class="support-zoom"><button type="button" data-action="close-zoom" aria-label="关闭大图">关闭</button><img alt="放大的二维码"></dialog>`;
    document.body.append(page);
    page.addEventListener('click', async event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.action === 'back') { close(); return; }
      if (button.dataset.action === 'zoom') {
        const dialog = page.querySelector('dialog');
        dialog.querySelector('img').src = './assets/support-images/' + button.dataset.image;
        dialog.querySelector('img').alt = button.querySelector('img').alt;
        dialog.showModal();
      }
      if (button.dataset.action === 'close-zoom') page.querySelector('dialog').close();
      if (button.dataset.action === 'copy') {
        try {
          if (root.electronAPI?.copyMiniProgram) await root.electronAPI.copyMiniProgram();
          else {
            const input = document.createElement('textarea'); input.value = MINI_PROGRAM; page.append(input); input.select();
            const copied = document.execCommand('copy'); input.remove();
            if (!copied && navigator.clipboard?.writeText) await navigator.clipboard.writeText(MINI_PROGRAM);
            else if (!copied) throw new Error('复制失败');
          }
          page.querySelector('.support-status').textContent = '小程序链接已复制，可粘贴到微信中打开。';
        } catch (_) { page.querySelector('.support-status').textContent = '未能自动复制，请选中上方链接后手动复制。'; }
      }
    });
  }
  root.supportProject = { open, close, hide, miniProgram: MINI_PROGRAM };
})(typeof window === 'object' ? window : globalThis);
