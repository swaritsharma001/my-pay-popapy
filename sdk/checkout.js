(function (global) {
  'use strict';

  var script = document.currentScript;
  var sdkUrl = script && script.src ? script.src : new URL('/checkout.js', location.href).href;
  var checkoutOrigin = new URL(sdkUrl, location.href).origin;
  var styleId = 'poppay-checkout-sdk-styles';

  function injectStyles() {
    if (document.getElementById(styleId)) return;
    var style = document.createElement('style');
    style.id = styleId;
    style.textContent = [
      '.pp-overlay{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(10,25,21,.58);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);opacity:0;transition:opacity .2s ease}',
      '.pp-overlay.pp-visible{opacity:1}',
      '.pp-modal{position:relative;width:min(100%,560px);height:min(760px,calc(100dvh - 48px));overflow:hidden;border:1px solid rgba(255,255,255,.72);border-radius:24px;background:#fffefa;box-shadow:0 28px 90px rgba(5,24,17,.3);transform:translateY(10px) scale(.985);transition:transform .24s cubic-bezier(.2,.7,.2,1)}',
      '.pp-visible .pp-modal{transform:translateY(0) scale(1)}',
      '.pp-close{position:absolute;top:12px;right:12px;z-index:2;display:grid;width:38px;height:38px;place-items:center;border:1px solid rgba(35,72,60,.12);border-radius:50%;background:rgba(255,254,250,.94);color:#24493e;cursor:pointer;box-shadow:0 4px 14px rgba(20,46,43,.1)}',
      '.pp-close:hover{background:#edf5eb}',
      '.pp-close:focus-visible{outline:3px solid #d29d43;outline-offset:2px}',
      '.pp-iframe{display:block;width:100%;height:100%;border:0;background:#f3f5ef}',
      '@media(max-width:640px){.pp-overlay{align-items:flex-end;padding:0;background:rgba(10,25,21,.55)}.pp-modal{width:100%;height:min(92dvh,850px);border-radius:22px 22px 0 0;border-bottom:0;transform:translateY(24px)}.pp-visible .pp-modal{transform:translateY(0)}.pp-close{top:10px;right:10px;width:34px;height:34px}}',
      '@media(prefers-reduced-motion:reduce){.pp-overlay,.pp-modal{transition:none}}',
    ].join('');
    document.head.appendChild(style);
  }

  function emit(name, detail) {
    global.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
  }

  function PopPay(options) {
    if (!(this instanceof PopPay)) return new PopPay(options);
    options = options || {};
    if (!/^pp_live_[A-Za-z0-9_-]+$/.test(String(options.key || ''))) {
      throw new Error('PopPay requires a valid public key.');
    }
    if (!/^order_[A-Za-z0-9_-]{12}$/.test(String(options.order_id || ''))) {
      throw new Error('PopPay requires a valid order_id.');
    }

    this.key = options.key;
    this.orderId = options.order_id;
    this.name = options.name || '';
    this.handler = typeof options.handler === 'function' ? options.handler : function () {};
    this.onDismiss = typeof options.onDismiss === 'function' ? options.onDismiss : function () {};
    this.overlay = null;
    this.iframe = null;
    this.previousFocus = null;
    this.boundMessage = null;
    this.boundKeydown = null;
    this.boundBackdrop = null;
  }

  PopPay.prototype.open = function () {
    if (this.overlay) return;
    injectStyles();
    this.previousFocus = document.activeElement;

    var overlay = document.createElement('div');
    overlay.className = 'pp-overlay';
    overlay.setAttribute('role', 'presentation');
    var modal = document.createElement('div');
    modal.className = 'pp-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'PopPay secure checkout');

    var closeButton = document.createElement('button');
    closeButton.className = 'pp-close';
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', 'Close checkout');
    closeButton.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>';

    var iframe = document.createElement('iframe');
    iframe.className = 'pp-iframe';
    iframe.title = this.name ? 'Checkout for ' + this.name : 'PopPay checkout';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allow = 'clipboard-write';
    iframe.src = new URL('/pay/' + encodeURIComponent(this.orderId), checkoutOrigin).href;

    modal.appendChild(closeButton);
    modal.appendChild(iframe);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    this.overlay = overlay;
    this.iframe = iframe;

    var self = this;
    this.boundMessage = function (event) {
      if (!self.iframe || event.origin !== checkoutOrigin || event.source !== self.iframe.contentWindow) {
        return;
      }
      var data = event.data;
      if (!data || typeof data !== 'object' || data.order_id !== self.orderId) return;
      if (data.type === 'payment.success') {
        emit('payment.success', {
          order_id: data.order_id,
          payment_id: data.payment_id,
          utr: data.utr,
          signature: data.signature,
        });
        try {
          self.handler({
            order_id: data.order_id,
            payment_id: data.payment_id,
            utr: data.utr,
            signature: data.signature,
          });
        } catch (error) {
          setTimeout(function () { throw error; }, 0);
        }
        self.close('payment.success');
      } else if (data.type === 'payment.failed') {
        emit('payment.failed', data);
      }
    };
    this.boundKeydown = function (event) {
      if (event.key === 'Escape') self.close('dismiss');
      if (event.key === 'Tab') {
        event.preventDefault();
        closeButton.focus();
      }
    };
    this.boundBackdrop = function (event) {
      if (event.target === overlay || event.target === closeButton) self.close('dismiss');
    };

    global.addEventListener('message', this.boundMessage);
    global.addEventListener('keydown', this.boundKeydown);
    overlay.addEventListener('click', this.boundBackdrop);
    document.documentElement.style.overflow = 'hidden';
    closeButton.addEventListener('click', function () { self.close('dismiss'); });
    requestAnimationFrame(function () { overlay.classList.add('pp-visible'); });
    closeButton.focus();
  };

  PopPay.prototype.close = function (reason) {
    if (!this.overlay) return;
    global.removeEventListener('message', this.boundMessage);
    global.removeEventListener('keydown', this.boundKeydown);
    this.overlay.removeEventListener('click', this.boundBackdrop);
    this.overlay.remove();
    this.overlay = null;
    this.iframe = null;
    document.documentElement.style.overflow = '';
    emit('modal.closed', { order_id: this.orderId, reason: reason || 'dismiss' });
    if (reason === 'dismiss') {
      try { this.onDismiss(); } catch (error) {
        setTimeout(function () { throw error; }, 0);
      }
    }
    if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
      this.previousFocus.focus();
    }
  };

  global.PopPay = PopPay;
})(window);
