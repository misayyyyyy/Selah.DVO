const sampleProducts = [
  {
    name: 'Classic Chocolate Chip',
    tag: 'Signature Cookie',
    description: 'A classic cookie loaded with chocolate chips.',
    price: 99,
    image: 'assets/cookies/Cookie1.png',
    fallbackImage: 'assets/cookies/Cookie1.png',
    bgStart: '#e8c868',
    bgEnd: '#d1a954',
    accent: '#f8e9b9',
    badge: 'Baked Daily',
    displayWord: 'COOKIE'
  },
  {
    name: 'Double Chocolate',
    tag: 'Rich & Decadent',
    description: 'A rich chocolate cookie made for chocolate lovers.',
    price: 119,
    image: 'assets/cookies/Cookie1.png',
    fallbackImage: 'assets/cookies/Cookie1.png',
    bgStart: '#c8aa8d',
    bgEnd: '#a88464',
    accent: '#d7b08b',
    badge: 'Cocoa Blend',
    displayWord: 'CHOCO'
  },
  {
    name: 'Red Velvet',
    tag: 'Velvety Treat',
    description: 'A soft red velvet cookie with a delicious creamy finish.',
    price: 129,
    image: 'assets/cookies/Cookie1.png',
    fallbackImage: 'assets/cookies/Cookie1.png',
    bgStart: '#d59a8f',
    bgEnd: '#c5827d',
    accent: '#f4d9d1',
    badge: 'Velvet Swirl',
    displayWord: 'VELVET'
  },
  {
    name: 'Matcha White Chocolate',
    tag: 'Green & Creamy',
    description: 'A flavorful matcha cookie with white chocolate pieces.',
    price: 129,
    image: 'assets/cookies/Cookie1.png',
    fallbackImage: 'assets/cookies/Cookie1.png',
    bgStart: '#bfd7b1',
    bgEnd: '#8da86d',
    accent: '#edf5d0',
    badge: 'Seasonal Pick',
    displayWord: 'MATCHA'
  }
];

let products = [...sampleProducts];
let catalogCookies = [...sampleProducts];

const root = document.documentElement;
const hero = document.querySelector('.hero');
const productName = document.getElementById('productName');
const productTag = document.getElementById('productTag');
const productDescription = document.getElementById('productDescription');
const productPrice = document.getElementById('productPrice');
const productCurrency = document.querySelector('.currency');
const productImage = document.getElementById('productImage');
const floatingBadge = document.getElementById('floatingBadge');
const displayWord = document.getElementById('displayWord');
const pagination = document.getElementById('carouselPagination');
const cookieGrid = document.getElementById('cookieGrid');
const cookieGridScrollbar = document.getElementById('cookieGridScrollbar');
const cookieGridScrollbarThumb = document.getElementById('cookieGridScrollbarThumb');
const productDialog = document.getElementById('productDialog');
const cartDialog = document.getElementById('cartDialog');
const socialConfirmDialog = document.getElementById('socialConfirmDialog');
const quantityInput = document.getElementById('quantityInput');
const cart = new Map();
let selectedProduct = null;
let modalTotalAnimationFrame = 0;
let modalTotalDisplayedAmount = null;

let activeIndex = 0;
let isAnimating = false;
let autoRotateTimer = null;
let autoRotateDeadline = 0;
let autoRotateRemaining = 6000;
const pointerPauseTargets = new Set();
const focusPauseTargets = new Set();
let lastInputWasPointer = false;
let swipePointer = null;

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const DESKTOP_WHEEL_STEP_PX = 170;

const currencySymbols = {
  PHP: '\u20B1',
  USD: '$',
  EUR: '\u20AC',
  GBP: '\u00A3'
};

function setProductImage(image, product) {
  image.onerror = () => {
    image.onerror = null;
    if (product.fallbackImage && product.fallbackImage !== product.image) {
      image.src = product.fallbackImage;
    }
  };
  image.src = product.image;
}

function readXmlText(parent, selector, fallback = '') {
  return parent.querySelector(selector)?.textContent.trim() || fallback;
}

function safeHexColor(value, fallback) {
  return /^#[\da-f]{6}$/i.test(value || '') ? value : fallback;
}

function relativeLuminance(hex) {
  const channels = hex.slice(1).match(/.{2}/g).map((channel) => parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(first, second) {
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function applySupportingSectionPalette(backgroundStart, backgroundEnd) {
  const backgroundLuminances = [backgroundStart, backgroundEnd].map(relativeLuminance);
  const palettes = [
    {
      ink: '#291a12',
      muted: 'rgba(41, 26, 18, 0.9)',
      accent: '#291a12',
      rule: 'rgba(41, 26, 18, 0.34)'
    },
    {
      ink: '#fff5e8',
      muted: 'rgba(255, 245, 232, 0.9)',
      accent: '#ffe0a8',
      rule: 'rgba(255, 245, 232, 0.4)'
    }
  ];
  const palette = palettes.reduce((best, candidate) => {
    const minimumContrast = Math.min(
      ...backgroundLuminances.map((background) => contrastRatio(relativeLuminance(candidate.ink), background))
    );
    return !best || minimumContrast > best.minimumContrast
      ? { ...candidate, minimumContrast }
      : best;
  }, null);

  root.style.setProperty('--support-ink', palette.ink);
  root.style.setProperty('--support-muted', palette.muted);
  root.style.setProperty('--support-accent', palette.accent);
  root.style.setProperty('--support-rule', palette.rule);
}

function parseCookiesXml(xmlText) {
  const documentXml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (documentXml.querySelector('parsererror')) {
    throw new Error('Cookies.xml contains invalid XML.');
  }

  const cookieNodes = [...documentXml.querySelectorAll('Cookies > Cookie')];
  if (!cookieNodes.length) {
    throw new Error('Cookies.xml does not contain any Cookie entries.');
  }

  return cookieNodes.map((node, index) => {
    const priceNode = node.querySelector('Price');
    const background = node.querySelector('Background');
    const name = readXmlText(node, 'Name');
    const priceText = priceNode?.textContent.trim() || '';
    const priceUnavailable = /^n\/a$/i.test(priceText);
    const price = priceUnavailable ? null : Number(priceText);
    const ingredientNodes = [...node.querySelectorAll('Ingredients > Ingredient')];
    const ingredientsNode = node.querySelector('Ingredients');
    const ingredients = ingredientNodes.length
      ? ingredientNodes.map((ingredient) => ingredient.textContent.trim()).filter(Boolean)
      : (ingredientsNode?.textContent || '')
          .split(/[,;\n]+/)
          .map((ingredient) => ingredient.trim())
          .filter(Boolean);

    if (!name || (!priceUnavailable && !Number.isFinite(price))) {
      throw new Error(`Cookie entry ${index + 1} needs a Name and a numeric Price or N/A.`);
    }

    return {
      id: node.getAttribute('id') || `cookie-${index + 1}`,
      name,
      tag: readXmlText(node, 'Tag', 'Freshly baked'),
      description: readXmlText(node, 'Description'),
      ingredients,
      heroCookie: readXmlText(node, 'HeroCookie', 'false').toLowerCase() === 'true',
      price,
      currency: (priceNode?.getAttribute('currency') || 'PHP').toUpperCase(),
      image: readXmlText(node, 'Image', 'assets/cookies/Cookie1.png'),
      fallbackImage: readXmlText(node, 'FallbackImage', 'assets/cookies/Cookie1.png'),
      bgStart: safeHexColor(background?.getAttribute('start'), '#e8c868'),
      bgEnd: safeHexColor(background?.getAttribute('end'), '#d1a954'),
      accent: safeHexColor(readXmlText(node, 'Accent'), '#f8e9b9'),
      badge: readXmlText(node, 'Badge', 'Baked Daily'),
      displayWord: readXmlText(node, 'DisplayWord', 'COOKIE')
    };
  });
}

async function loadCookiesFromXml() {
  const response = await fetch('./Cookies.xml', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Cookies.xml request failed (${response.status}).`);
  }

  return parseCookiesXml(await response.text());
}

function currencySymbol(product) {
  return currencySymbols[product.currency] || product.currency || '\u20B1';
}

function formatPrice(product, amount = product.price) {
  if (!Number.isFinite(Number(amount)) || amount === null || amount === '') {
    return 'Price on request';
  }
  return `${currencySymbol(product)}${Number(amount).toLocaleString('en-PH')}`;
}

function renderCookieCatalog() {
  const grid = cookieGrid;
  if (!grid) return;

  grid.replaceChildren();

  catalogCookies.forEach((product) => {
    const card = document.createElement('a');
    card.href = '#productDialog';
    card.className = 'cookie-card';
    card.setAttribute('aria-label', `View details for ${product.name}`);
    card.addEventListener('click', (event) => {
      event.preventDefault();
      openProductModal(product);
    });

    const imageFrame = document.createElement('div');
    imageFrame.className = 'cookie-card-image';
    imageFrame.style.background = `linear-gradient(145deg, ${product.bgStart}, ${product.bgEnd})`;

    const picture = document.createElement('picture');
    picture.className = 'responsive-picture';
    const image = document.createElement('img');
    image.alt = `${product.name} cookie`;
    image.loading = 'lazy';
    image.decoding = 'async';
    picture.append(image);
    setProductImage(image, product);
    imageFrame.append(picture);

    const content = document.createElement('div');
    content.className = 'cookie-card-content';

    const tag = document.createElement('p');
    tag.className = 'cookie-card-tag';
    tag.textContent = product.tag;

    const name = document.createElement('h3');
    name.textContent = product.name;

    const description = document.createElement('p');
    description.className = 'cookie-card-description';
    description.textContent = product.description;

    const footer = document.createElement('div');
    footer.className = 'cookie-card-footer';

    const price = document.createElement('span');
    price.className = 'cookie-card-price';
    const viewLink = document.createElement('span');
    viewLink.className = 'cookie-card-link';
    viewLink.textContent = `View details  ${'\u2192'}`;

    price.textContent = formatPrice(product);
    footer.append(price, viewLink);
    content.append(tag, name, description, footer);
    card.append(imageFrame, content);
    grid.append(card);
  });

  requestAnimationFrame(updateCookieGridScrollbar);
}

function updateCookieGridScrollbar() {
  if (!cookieGrid || !cookieGridScrollbar || !cookieGridScrollbarThumb) return;

  const { clientHeight, scrollHeight, scrollTop } = cookieGrid;
  const trackHeight = cookieGridScrollbar.clientHeight;
  const canScroll = scrollHeight > clientHeight + 1 && trackHeight > 0;
  cookieGridScrollbar.hidden = !canScroll;
  if (!canScroll) return;

  const thumbHeight = Math.max(28, (clientHeight / scrollHeight) * trackHeight);
  const travel = Math.max(0, trackHeight - thumbHeight);
  const progress = scrollTop / (scrollHeight - clientHeight);
  cookieGridScrollbarThumb.style.height = `${thumbHeight}px`;
  cookieGridScrollbarThumb.style.transform = `translate3d(0, ${travel * progress}px, 0)`;
}

function bindCookieGridScrollbar() {
  if (!cookieGrid || !cookieGridScrollbar) return;
  cookieGrid.addEventListener('scroll', updateCookieGridScrollbar, { passive: true });
  window.addEventListener('resize', updateCookieGridScrollbar);
  updateCookieGridScrollbar();
}

function openProductModal(product) {
  if (!product || !productDialog) return;
  selectedProduct = product;

  document.getElementById('modalCookieTag').textContent = product.tag;
  document.getElementById('modalCookieName').textContent = product.name;
  document.getElementById('modalCookieDescription').textContent = product.description;
  document.getElementById('modalUnitPrice').textContent = formatPrice(product);
  const priceUnavailable = !Number.isFinite(product.price);
  const buyButton = document.getElementById('buyButton');
  buyButton.disabled = priceUnavailable;
  quantityInput.disabled = priceUnavailable;
  document.getElementById('quantityDecrease').disabled = priceUnavailable;
  document.getElementById('quantityIncrease').disabled = priceUnavailable;
  document.getElementById('orderMessageStatus').textContent = priceUnavailable
    ? 'Choose a platform to ask about availability and confirm the price.'
    : 'Choose a platform to copy your order message and open its chat. In Messenger, click Continue, then paste and send.';

  const modalImage = document.getElementById('modalCookieImage');
  modalImage.alt = `${product.name} cookie`;
  setProductImage(modalImage, product);
  document.getElementById('modalImageFrame').style.background =
    `linear-gradient(145deg, ${product.bgStart}, ${product.bgEnd})`;

  const ingredientList = document.getElementById('ingredientList');
  const ingredientEmpty = document.getElementById('ingredientEmpty');
  ingredientList.replaceChildren();
  (product.ingredients || []).forEach((ingredient) => {
    const item = document.createElement('li');
    item.textContent = ingredient;
    ingredientList.append(item);
  });
  ingredientList.hidden = !product.ingredients?.length;
  ingredientEmpty.hidden = Boolean(product.ingredients?.length);

  quantityInput.value = '1';
  updateModalTotal(false);
  productDialog.showModal();
}

function currentQuantity() {
  const entered = Number.parseInt(quantityInput.value, 10);
  return Math.min(99, Math.max(1, Number.isFinite(entered) ? entered : 1));
}

function updateModalTotal(animate = true) {
  const product = selectedProduct;
  if (!product) return;

  const totalElement = document.getElementById('modalTotal');
  if (modalTotalAnimationFrame) {
    cancelAnimationFrame(modalTotalAnimationFrame);
    modalTotalAnimationFrame = 0;
  }

  const quantity = currentQuantity();
  const targetAmount = product.price * quantity;
  if (!Number.isFinite(targetAmount)) {
    modalTotalDisplayedAmount = null;
    totalElement.classList.remove('is-counting');
    totalElement.textContent = 'Price on request';
    return;
  }

  if (!animate || prefersReducedMotion || modalTotalDisplayedAmount === null) {
    modalTotalDisplayedAmount = targetAmount;
    totalElement.classList.remove('is-counting');
    totalElement.textContent = formatPrice(product, targetAmount);
    return;
  }

  const startingAmount = modalTotalDisplayedAmount;
  const startTime = performance.now();
  const duration = 420;
  totalElement.classList.add('is-counting');

  const animateAmount = (time) => {
    const progress = Math.min(1, (time - startTime) / duration);
    const easedProgress = 1 - (1 - progress) ** 3;
    modalTotalDisplayedAmount = startingAmount + (targetAmount - startingAmount) * easedProgress;
    totalElement.textContent = formatPrice(product, Math.round(modalTotalDisplayedAmount));

    if (progress < 1) {
      modalTotalAnimationFrame = requestAnimationFrame(animateAmount);
      return;
    }

    modalTotalAnimationFrame = 0;
    modalTotalDisplayedAmount = targetAmount;
    totalElement.textContent = formatPrice(product, targetAmount);
    totalElement.classList.remove('is-counting');
  };

  modalTotalAnimationFrame = requestAnimationFrame(animateAmount);

}

function updateCartCount() {
  const count = [...cart.values()].reduce((sum, entry) => sum + entry.quantity, 0);
  const cartCount = document.getElementById('cartCount');
  const cartButton = document.querySelector('.cart-button');
  cartCount.textContent = String(count);
  cartCount.hidden = count === 0;
  cartButton.setAttribute('aria-label', count ? `View cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'View cart');
}

function renderCart() {
  const cartItems = document.getElementById('cartItems');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartSummaryRow = document.getElementById('cartSummaryRow');
  const cartFacebookOrderButton = document.getElementById('cartFacebookOrderButton');
  const cartInstagramOrderButton = document.getElementById('cartInstagramOrderButton');
  const entries = [...cart.entries()];
  cartItems.replaceChildren();
  cartEmpty.hidden = entries.length > 0;
  cartSummaryRow.hidden = entries.length === 0;
  cartFacebookOrderButton.hidden = entries.length === 0;
  cartInstagramOrderButton.hidden = entries.length === 0;
  document.getElementById('cartOrderStatus').textContent = entries.length
    ? 'Choose a platform to copy your item list and open the chat. In Messenger, click Continue, then paste and send.'
    : 'Add cookies to your order, then choose where to send it.';

  let subtotal = 0;
  entries.forEach(([id, entry]) => {
    const row = document.createElement('div');
    row.className = 'cart-item';

    const info = document.createElement('div');
    info.className = 'cart-item-info';
    const name = document.createElement('strong');
    name.textContent = entry.product.name;
    const meta = document.createElement('span');
    meta.textContent = `${entry.quantity} × ${formatPrice(entry.product)}`;
    info.append(name, meta);

    const side = document.createElement('div');
    side.className = 'cart-item-side';
    const lineTotal = document.createElement('strong');
    lineTotal.textContent = formatPrice(entry.product, entry.quantity * entry.product.price);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'cart-remove';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${entry.product.name} from your order`);
    remove.addEventListener('click', () => {
      cart.delete(id);
      renderCart();
      updateCartCount();
    });
    side.append(lineTotal, remove);
    row.append(info, side);
    cartItems.append(row);
    subtotal += entry.quantity * entry.product.price;
  });

  const subtotalCurrency = entries[0]?.[1].product || { currency: 'PHP' };
  document.getElementById('cartSubtotal').textContent = formatPrice(subtotalCurrency, subtotal);
  updateCartCount();
}

function addSelectedCookieToCart() {
  const product = selectedProduct;
  if (!product || !Number.isFinite(product.price)) return;

  const id = product.id || product.name;
  const previous = cart.get(id);
  cart.set(id, {
    product,
    quantity: (previous?.quantity || 0) + currentQuantity()
  });
  productDialog.close();
  renderCart();
  cartDialog.showModal();
}

function buildOrderMessage() {
  return `Hello, is ${selectedProduct.name} still available? I would like to order ${currentQuantity()} of this.`;
}

function buildCartOrderMessage() {
  const lines = [...cart.values()].map(({ product, quantity }) => `- ${product.name} × ${quantity}`);
  return `Hello, are these cookies still available? I would like to order:\n${lines.join('\n')}`;
}

function copyTextFallback(text) {
  const temporaryInput = document.createElement('textarea');
  temporaryInput.value = text;
  temporaryInput.setAttribute('readonly', '');
  temporaryInput.setAttribute('aria-hidden', 'true');
  Object.assign(temporaryInput.style, {
    position: 'fixed',
    inset: '0 auto auto -9999px',
    opacity: '0',
    pointerEvents: 'none'
  });
  document.body.append(temporaryInput);
  temporaryInput.select();

  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  temporaryInput.remove();
  return copied;
}

let socialActionNoticeTimer = 0;
let socialActionNoticeHideTimer = 0;

function showSocialActionNotice(platform, copyState = null) {
  const destination = platform === 'facebook'
    ? (copyState === null ? 'Facebook' : 'Facebook Messenger')
    : 'Instagram';
  const message = copyState === true
    ? `Order message copied to the clipboard. Paste it into ${destination} and review it before sending.`
    : copyState === false
      ? 'The order message could not be copied. You can still paste it manually from the order details.'
      : `${destination} is opening in a new tab.`;

  const host = document.querySelector('dialog[open]') || document.body;
  let notice = document.getElementById('socialActionNotice');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'socialActionNotice';
    notice.className = 'social-action-notice';
    notice.setAttribute('role', 'status');
    notice.setAttribute('aria-live', 'polite');
    notice.setAttribute('aria-atomic', 'true');
    notice.hidden = true;
  }
  if (notice.parentElement !== host) host.append(notice);

  window.clearTimeout(socialActionNoticeTimer);
  window.clearTimeout(socialActionNoticeHideTimer);
  notice.textContent = message;
  notice.hidden = false;
  requestAnimationFrame(() => notice.classList.add('is-visible'));

  socialActionNoticeTimer = window.setTimeout(() => {
    notice.classList.remove('is-visible');
    socialActionNoticeHideTimer = window.setTimeout(() => {
      if (!notice.classList.contains('is-visible')) notice.hidden = true;
    }, 260);
  }, 5000);
}

let pendingSocialAction = null;

function showSocialConfirmation(action) {
  if (!socialConfirmDialog) return;
  pendingSocialAction = action;

  const destination = action.orderMessage
    ? (action.platform === 'facebook' ? 'Facebook Messenger' : 'Instagram')
    : (action.platform === 'facebook' ? 'Facebook' : 'Instagram');
  document.getElementById('socialConfirmTitle').textContent = `Open ${destination}?`;
  document.getElementById('socialConfirmMessage').textContent = `You will be opening ${destination}.`;
  document.getElementById('socialConfirmOrderNote').hidden = !action.orderMessage;
  document.getElementById('socialConfirmContinue').textContent = `Continue to ${destination}`;
  socialConfirmDialog.showModal();
}

function launchSocialAction(action) {
  if (!action.orderMessage) {
    window.open(action.url, '_blank', 'noopener,noreferrer');
    showSocialActionNotice(action.platform);
    return;
  }

  const fallbackCopied = copyTextFallback(action.orderMessage);
  let clipboardWrite;
  try {
    clipboardWrite = navigator.clipboard?.writeText(action.orderMessage);
  } catch {
    clipboardWrite = null;
  }
  window.open(action.url, '_blank', 'noopener,noreferrer');

  const destination = action.platform === 'facebook' ? 'Facebook Messenger' : 'Instagram';
  const copiedStatus = action.platform === 'facebook'
    ? 'Your message is copied. In Messenger, click Continue, paste it into the chat, and tap Send.'
    : 'Your message is copied. Paste it into the Instagram chat and tap Send.';

  Promise.resolve(clipboardWrite).then(() => {
    if (!clipboardWrite && !fallbackCopied) throw new Error('Clipboard access unavailable.');
    if (action.status) action.status.textContent = copiedStatus;
    showSocialActionNotice(action.platform, true);
  }).catch(() => {
    const copied = Boolean(fallbackCopied);
    if (action.status) {
      action.status.textContent = copied
        ? copiedStatus
        : `The ${destination} chat is open, but automatic copying failed. You can copy the message from the order details.`;
    }
    showSocialActionNotice(action.platform, copied);
  });

}

function bindSocialActionNotices() {
  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = link.href.toLowerCase();
    const platform = href.includes('facebook') || href.includes('m.me')
      ? 'facebook'
      : href.includes('instagram') || href.includes('ig.me')
        ? 'instagram'
        : null;
    if (!platform) return;

    event.preventDefault();
    showSocialConfirmation({
      platform,
      url: link.href
    });
  }, true);

  document.getElementById('socialConfirmContinue').addEventListener('click', () => {
    const action = pendingSocialAction;
    if (!action) return;
    pendingSocialAction = null;
    socialConfirmDialog.close();
    launchSocialAction(action);
  });

  socialConfirmDialog.addEventListener('close', () => {
    pendingSocialAction = null;
  });

  socialConfirmDialog.addEventListener('click', (event) => {
    if (event.target === socialConfirmDialog) socialConfirmDialog.close();
  });
}

function openOrderChat(platform, orderMessage = buildOrderMessage(), status = document.getElementById('orderMessageStatus')) {
  const chatUrls = {
    facebook: 'https://m.me/61575481432713',
    instagram: 'https://ig.me/m/selah.dvo'
  };
  const url = chatUrls[platform];
  if (!url) return;
  showSocialConfirmation({ platform, url, orderMessage, status });
}

function bindShoppingControls() {
  document.querySelector('.cart-button').addEventListener('click', () => {
    renderCart();
    cartDialog.showModal();
  });

  document.getElementById('quantityDecrease').addEventListener('click', () => {
    quantityInput.value = String(Math.max(1, currentQuantity() - 1));
    updateModalTotal();
  });

  document.getElementById('quantityIncrease').addEventListener('click', () => {
    quantityInput.value = String(Math.min(99, currentQuantity() + 1));
    updateModalTotal();
  });

  quantityInput.addEventListener('input', () => updateModalTotal());
  quantityInput.addEventListener('change', () => {
    quantityInput.value = String(currentQuantity());
    updateModalTotal();
  });
  document.getElementById('buyButton').addEventListener('click', addSelectedCookieToCart);
  document.getElementById('facebookOrderButton').addEventListener('click', () => openOrderChat('facebook'));
  document.getElementById('instagramOrderButton').addEventListener('click', () => openOrderChat('instagram'));
  document.getElementById('cartFacebookOrderButton').addEventListener('click', () => (
    openOrderChat('facebook', buildCartOrderMessage(), document.getElementById('cartOrderStatus'))
  ));
  document.getElementById('cartInstagramOrderButton').addEventListener('click', () => (
    openOrderChat('instagram', buildCartOrderMessage(), document.getElementById('cartOrderStatus'))
  ));

  document.querySelector('.purchase-row .cta').addEventListener('click', (event) => {
    event.preventDefault();
    openProductModal(products[activeIndex]);
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => {
      document.getElementById(button.dataset.closeDialog)?.close();
    });
  });

  [productDialog, cartDialog].forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

function bindStickyMobileNav() {
  const stickyNav = document.querySelector('.mobile-sticky-nav');
  const sentinel = document.querySelector('.mobile-nav-sentinel');
  const cartButton = document.querySelector('.cart-button');
  const topbarActions = document.querySelector('.topbar-actions');
  if (!stickyNav || !sentinel || !cartButton || !topbarActions || !('IntersectionObserver' in window)) return;

  const mobileQuery = window.matchMedia('(max-width: 700px)');
  let socialReturnAnimations = [];
  const updateCartPosition = () => {
    const navBottom = stickyNav.getBoundingClientRect().bottom;
    cartButton.style.setProperty('--mobile-cart-top', `${Math.ceil(navBottom + 8)}px`);
  };

  const cancelSocialReturnAnimations = () => {
    socialReturnAnimations.forEach((animation) => animation.cancel());
    socialReturnAnimations = [];
  };

  const animateSocialButtonsBeforeCartReturns = () => {
    cancelSocialReturnAnimations();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const socialButtons = [...topbarActions.querySelectorAll('.socials a')];
    const currentPositions = socialButtons.map((button) => button.getBoundingClientRect());
    cartButton.classList.remove('is-below-mobile-nav', 'is-leaving-mobile-nav');
    const returnPositions = socialButtons.map((button) => button.getBoundingClientRect());
    cartButton.classList.add('is-leaving-mobile-nav');
    updateCartPosition();

    socialReturnAnimations = socialButtons.map((button, index) => {
      const deltaX = returnPositions[index].left - currentPositions[index].left;
      const deltaY = returnPositions[index].top - currentPositions[index].top;
      return button.animate?.([
        { transform: 'translate(0, -6px)' },
        { transform: `translate(${deltaX}px, ${deltaY}px)` }
      ], {
        duration: 280,
        delay: index * 25,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards'
      });
    }).filter(Boolean);
  };

  cartButton.addEventListener('animationend', (event) => {
    if (event.animationName === 'mobile-cart-return-to-topbar') {
      cartButton.classList.remove('is-returning-to-topbar');
      return;
    }

    if (event.animationName !== 'mobile-cart-depart' || stickyNav.classList.contains('is-stuck')) return;
    cartButton.classList.remove('is-leaving-mobile-nav');
    cancelSocialReturnAnimations();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cartButton.classList.add('is-returning-to-topbar');
    }
  });

  const setStickyState = (shouldStick) => {
    const isStuck = mobileQuery.matches && shouldStick;
    const wasStuck = stickyNav.classList.contains('is-stuck');

    if (isStuck) {
      stickyNav.classList.add('is-stuck');
      cancelSocialReturnAnimations();
      cartButton.classList.remove('is-leaving-mobile-nav', 'is-returning-to-topbar');
      cartButton.classList.add('is-below-mobile-nav');
      updateCartPosition();
      return;
    }

    stickyNav.classList.remove('is-stuck');
    if (!mobileQuery.matches) {
      cancelSocialReturnAnimations();
      cartButton.classList.remove('is-below-mobile-nav', 'is-leaving-mobile-nav', 'is-returning-to-topbar');
      return;
    }

    if (wasStuck && cartButton.classList.contains('is-below-mobile-nav')) {
      animateSocialButtonsBeforeCartReturns();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        cartButton.classList.remove('is-below-mobile-nav', 'is-leaving-mobile-nav');
      }
    }
  };

  const observer = new IntersectionObserver(([entry]) => {
    setStickyState(!entry.isIntersecting);
  }, { threshold: 0 });

  observer.observe(sentinel);
  window.addEventListener('scroll', () => {
    if (cartButton.classList.contains('is-below-mobile-nav')
      || cartButton.classList.contains('is-leaving-mobile-nav')) {
      updateCartPosition();
    }
  }, { passive: true });
  window.addEventListener('resize', () => {
    setStickyState(sentinel.getBoundingClientRect().bottom <= 0);
  });
}

function bindStickyDesktopTopbar() {
  const topbar = document.querySelector('.topbar');
  const sentinel = document.querySelector('.desktop-sticky-sentinel');
  if (!topbar || !sentinel) return;

  const desktopQuery = window.matchMedia('(min-width: 981px)');
  const updateStickyState = () => {
    const isStuck = desktopQuery.matches && sentinel.getBoundingClientRect().top <= 10;
    topbar.classList.toggle('is-stuck', isStuck);
  };

  window.addEventListener('scroll', updateStickyState, { passive: true });
  window.addEventListener('resize', updateStickyState);
  updateStickyState();
}

function bindDesktopWheelSmoothing() {
  if (prefersReducedMotion) return;

  let animationFrame = 0;
  let restoreTimer = 0;
  let currentY = window.scrollY;
  let targetY = currentY;
  let previousScrollBehavior = '';
  let customScrollActive = false;

  function getWheelDistance(event) {
    const direction = Math.sign(event.deltaY || -event.wheelDelta || 0);
    if (!direction) return 0;

    const legacyDelta = Math.abs(Number(event.wheelDelta) || 0);
    const notchCount = legacyDelta >= 120
      ? Math.max(1, Math.round(legacyDelta / 120))
      : 0;

    if (event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL) {
      return direction * DESKTOP_WHEEL_STEP_PX * (notchCount || 1);
    }

    if (notchCount) {
      return direction * DESKTOP_WHEEL_STEP_PX * notchCount;
    }

    return event.deltaY;
  }

  function animateScroll() {
    currentY += (targetY - currentY) * 0.075;

    if (Math.abs(targetY - currentY) < 0.35) {
      currentY = targetY;
      window.scrollTo(0, currentY);
      animationFrame = 0;
      restoreTimer = window.setTimeout(() => {
        if (animationFrame) return;
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
        customScrollActive = false;
        restoreTimer = 0;
      }, 140);
      return;
    }

    window.scrollTo(0, currentY);
    animationFrame = window.requestAnimationFrame(animateScroll);
  }

  function handOffToAnchorNavigation() {
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    if (restoreTimer) {
      window.clearTimeout(restoreTimer);
      restoreTimer = 0;
    }

    if (customScrollActive) {
      document.documentElement.style.scrollBehavior = previousScrollBehavior;
      customScrollActive = false;
    }

    currentY = window.scrollY;
    targetY = currentY;
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    // Stop the wheel glide before any in-page anchor starts its own smooth
    // scroll. Otherwise both scroll animations compete and the click can look
    // ignored until the wheel animation finishes.
    if (!event.target.closest('a[href^="#"]')) return;

    handOffToAnchorNavigation();
  }, true);

  window.addEventListener('wheel', (event) => {
    if (
      window.matchMedia('(max-width: 700px)').matches ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.shiftKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY)
    ) {
      return;
    }

    if (event.target instanceof Element && event.target.closest('dialog[open], textarea, select, [data-native-scroll]')) {
      return;
    }

    const deltaY = getWheelDistance(event);
    if (!deltaY) return;

    event.preventDefault();

    if (!customScrollActive) {
      previousScrollBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = 'auto';
      currentY = window.scrollY;
      targetY = currentY;
      customScrollActive = true;
    }

    if (restoreTimer) {
      window.clearTimeout(restoreTimer);
      restoreTimer = 0;
    }

    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    targetY = Math.max(0, Math.min(maxScrollY, targetY + deltaY));

    if (!animationFrame) {
      animationFrame = window.requestAnimationFrame(animateScroll);
    }
  }, { passive: false });
}

function renderPagination() {
  const dots = products
    .map(
      (_, index) =>
        `<button class="dot ${index === activeIndex ? 'active' : ''}" type="button" aria-label="Go to product ${index + 1}" data-index="${index}"></button>`
    )
    .join('');

  pagination.innerHTML = `
    <div class="pagination-dots">${dots}</div>
    <span class="pagination-progress" aria-hidden="true"><span class="pagination-progress-fill"></span></span>
  `;

  for (const dot of pagination.querySelectorAll('.dot')) {
    dot.addEventListener('click', () => {
      const nextIndex = Number(dot.dataset.index);
      goToSlide(nextIndex, true);
    });
  }
}

function fitHeroDisplayWord() {
  const headlineWrap = document.querySelector('.hero-headline');
  const headlineText = displayWord?.dataset.headlineText?.trim();
  if (!headlineWrap || !headlineText) return;

  displayWord.style.removeProperty('font-size');
  const styles = getComputedStyle(displayWord);
  const baseFontSize = Number.parseFloat(styles.fontSize);
  const availableWidth = headlineWrap.clientWidth * 0.96;
  if (!baseFontSize || !availableWidth || !headlineWrap.clientHeight) return;

  const context = document.createElement('canvas').getContext('2d');
  if (!context) return;
  context.font = `${styles.fontWeight} ${baseFontSize}px ${styles.fontFamily}`;

  const words = headlineText.toLocaleUpperCase().split(/\s+/);
  const tracking = Number.parseFloat(styles.letterSpacing) || 0;
  const measure = (text) => context.measureText(text).width + Math.max(0, text.length - 1) * tracking;
  const useTwoLines = words.length > 2 || headlineText.length > 16;
  let lines = [headlineText.toLocaleUpperCase()];

  if (useTwoLines && words.length > 1) {
    let bestSplit = 1;
    let narrowestSplit = Infinity;
    for (let split = 1; split < words.length; split += 1) {
      const lineWidth = Math.max(
        measure(words.slice(0, split).join(' ')),
        measure(words.slice(split).join(' '))
      );
      if (lineWidth < narrowestSplit) {
        narrowestSplit = lineWidth;
        bestSplit = split;
      }
    }
    lines = [words.slice(0, bestSplit).join(' '), words.slice(bestSplit).join(' ')];
  }

  displayWord.replaceChildren();
  lines.forEach((line, index) => {
    if (index) displayWord.append(document.createElement('br'));
    displayWord.append(document.createTextNode(line));
  });

  const naturalWidth = Math.max(...lines.map(measure));
  const maxFontSize = headlineWrap.clientHeight * 0.92 / (lines.length * 0.78);
  const fittedFontSize = Math.min(baseFontSize * (availableWidth / naturalWidth), maxFontSize);
  displayWord.style.fontSize = `${fittedFontSize}px`;
}

function fitHeroProductName() {
  if (!productName) return;

  productName.style.removeProperty('font-size');
  const styles = getComputedStyle(productName);
  const baseFontSize = Number.parseFloat(styles.fontSize);
  const availableWidth = productName.clientWidth;
  if (!baseFontSize || !availableWidth) return;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;

  context.font = `${styles.fontWeight} ${baseFontSize}px ${styles.fontFamily}`;
  const text = productName.textContent.trim().toLocaleUpperCase();
  const words = text.split(/\s+/);
  const tracking = Number.parseFloat(styles.letterSpacing) || 0;
  const measure = (value) => {
    const length = value.length;
    return context.measureText(value).width + Math.max(0, length - 1) * tracking;
  };

  if (measure(text) <= availableWidth) return;

  let narrowestTwoLineLayout = measure(text);
  for (let split = 1; split < words.length; split += 1) {
    const lineWidth = Math.max(
      measure(words.slice(0, split).join(' ')),
      measure(words.slice(split).join(' '))
    );
    narrowestTwoLineLayout = Math.min(narrowestTwoLineLayout, lineWidth);
  }

  const fittedFontSize = baseFontSize * Math.min(1, availableWidth / narrowestTwoLineLayout);
  productName.style.fontSize = `${fittedFontSize}px`;
}

function bindHeroDisplayWordFit() {
  const fitHeroText = () => {
    fitHeroDisplayWord();
    fitHeroProductName();
  };

  window.addEventListener('resize', () => {
    fitHeroText();
  }, { passive: true });
  document.fonts?.ready.then(fitHeroText);
  document.fonts?.addEventListener('loadingdone', fitHeroText);
}

function updateProduct(product) {
  productName.textContent = product.name;
  fitHeroProductName();
  productTag.textContent = product.tag;
  productDescription.textContent = product.description;
  productPrice.textContent = Number.isFinite(product.price) ? String(product.price) : 'N/A';
  productCurrency.hidden = !Number.isFinite(product.price);
  if (Number.isFinite(product.price)) productCurrency.textContent = currencySymbol(product);
  floatingBadge.textContent = product.badge;
  displayWord.dataset.headlineText = product.displayWord || product.name;
  fitHeroDisplayWord();

  setProductImage(productImage, product);
  productImage.alt = `${product.name} cookie`;

  root.style.setProperty('--bg-start', product.bgStart);
  root.style.setProperty('--bg-end', product.bgEnd);
  root.style.setProperty('--accent', product.accent);
  applySupportingSectionPalette(product.bgStart, product.bgEnd);
  root.style.setProperty('--panel', 'rgba(255,255,255,0.18)');
  root.style.setProperty('--panel-border', 'rgba(255,255,255,0.22)');
  try {
    localStorage.setItem('selahHeroPalette', JSON.stringify({ bgStart: product.bgStart, bgEnd: product.bgEnd }));
    if (product.id) localStorage.setItem('selahHeroProductId', product.id);
  } catch {
    // The hero still works normally when browser storage is unavailable.
  }
}

function goToSlide(nextIndex, userInitiated = false, direction = null) {
  if (isAnimating || nextIndex === activeIndex) {
    return;
  }

  if (userInitiated) pauseAutoRotate();

  const slideDirection = direction ?? (nextIndex > activeIndex ? 1 : -1);
  isAnimating = true;
  hero.dataset.animating = 'true';
  hero.dataset.direction = slideDirection > 0 ? 'next' : 'previous';

  activeIndex = (nextIndex + products.length) % products.length;
  updateProduct(products[activeIndex]);
  renderPagination();

  window.setTimeout(() => {
    hero.dataset.animating = 'false';
    isAnimating = false;
    if (userInitiated) {
      autoRotateRemaining = 6000;
      if (!pointerPauseTargets.size && !focusPauseTargets.size) {
        restartAutoRotate(true);
      }
    }
  }, 720);
}

function step(direction) {
  const nextIndex = (activeIndex + direction + products.length) % products.length;
  goToSlide(nextIndex, true, direction);
}

function restartAutoRotate(resetCountdown = false) {
  if (autoRotateTimer && !resetCountdown) {
    return;
  }

  if (autoRotateTimer) {
    clearTimeout(autoRotateTimer);
    autoRotateTimer = null;
  }

  if (prefersReducedMotion || products.length < 2) {
    pagination.classList.remove('is-playing', 'has-autoplay');
    pagination.classList.remove('is-paused');
    autoRotateRemaining = 6000;
    autoRotateDeadline = 0;
    return;
  }

  if (resetCountdown || autoRotateRemaining <= 0) {
    autoRotateRemaining = 6000;
  }

  pagination.classList.add('has-autoplay', 'is-playing');
  pagination.classList.remove('is-paused');
  autoRotateDeadline = performance.now() + autoRotateRemaining;
  autoRotateTimer = setTimeout(() => {
    autoRotateTimer = null;
    autoRotateDeadline = 0;
    autoRotateRemaining = 6000;
    const nextIndex = (activeIndex + 1) % products.length;
    goToSlide(nextIndex, false, 1);
    restartAutoRotate();
  }, autoRotateRemaining);
}

function pauseAutoRotate() {
  if (autoRotateTimer) {
    clearTimeout(autoRotateTimer);
    autoRotateTimer = null;
    autoRotateRemaining = Math.max(0, autoRotateDeadline - performance.now());
    autoRotateDeadline = 0;
  }
  if (pagination.classList.contains('is-playing')) {
    pagination.classList.add('is-paused');
  }
}

function resumeAutoRotateAfterInteraction() {
  if (!pointerPauseTargets.size && !focusPauseTargets.size) {
    restartAutoRotate();
  }
}

function bindArrowControls() {
  const prevButton = document.querySelector('.arrow-left');
  const nextButton = document.querySelector('.arrow-right');

  prevButton.addEventListener('click', () => step(-1));
  nextButton.addEventListener('click', () => step(1));
}

function bindKeyboardControls() {
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      step(1);
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      step(-1);
    }
  });
}

function bindPointerControls() {
  const heroNode = document.querySelector('.hero');
  const interactiveSelector = 'a, button, input, select, textarea, [contenteditable="true"], [role="button"]';

  heroNode.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.button !== 0 || event.target.closest(interactiveSelector)) {
      return;
    }

    swipePointer = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY
    };
  });

  window.addEventListener('pointerup', (event) => {
    if (!swipePointer || event.pointerId !== swipePointer.id) {
      return;
    }

    const deltaX = event.clientX - swipePointer.startX;
    const deltaY = event.clientY - swipePointer.startY;
    swipePointer = null;

    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      step(deltaX < 0 ? 1 : -1);
    }
  }, true);

  window.addEventListener('pointercancel', (event) => {
    if (swipePointer?.id === event.pointerId) {
      swipePointer = null;
    }
  }, true);
}

function bindInteractionPause() {
  const pauseTargets = [document.querySelector('.hero'), document.querySelector('.topbar')];

  window.addEventListener('pointerdown', (event) => {
    lastInputWasPointer = true;
    focusPauseTargets.forEach((target) => {
      if (target.contains(event.target)) {
        focusPauseTargets.delete(target);
      }
    });
  }, true);

  window.addEventListener('keydown', () => {
    lastInputWasPointer = false;
  }, true);

  pauseTargets.forEach((target) => {
    if (!target) {
      return;
    }

    target.addEventListener('pointerenter', () => {
      pointerPauseTargets.add(target);
      pauseAutoRotate();
    });

    target.addEventListener('pointerleave', () => {
      pointerPauseTargets.delete(target);
      resumeAutoRotateAfterInteraction();
    });

    target.addEventListener('focusin', () => {
      if (lastInputWasPointer) {
        return;
      }
      focusPauseTargets.add(target);
      pauseAutoRotate();
    });

    target.addEventListener('focusout', () => {
      if (target.contains(document.activeElement)) {
        return;
      }
      focusPauseTargets.delete(target);
      resumeAutoRotateAfterInteraction();
    });
  });
}

function bindClickAnimations() {
  if (prefersReducedMotion) return;

  const controlSelector = [
    'button',
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'a'
  ].join(', ');
  const layers = new WeakMap();
  const particles = ['✦', '✧', '•', '✦', '·', '✧', '✦', '•'];
  const colors = ['#ffd36e', '#fff9e8', '#e9a84f', '#fff0bd'];
  const feedbackState = new WeakMap();
  const maxActiveParticles = 24;
  const burstCooldownMs = 130;
  const feedbackCooldownMs = 90;
  let activeParticles = 0;
  let lastBurstAt = 0;

  function getLayer(control) {
    // If this click opens a dialog, the document bubble phase runs after
    // showModal(), so place the particles in that dialog's top layer.
    const host = control.closest('dialog[open]') || document.querySelector('dialog[open]') || document.body;
    let layer = layers.get(host);

    if (!layer) {
      layer = document.createElement('div');
      layer.className = 'click-particle-layer';
      layer.setAttribute('aria-hidden', 'true');
      host.append(layer);
      layers.set(host, layer);
    }

    return layer;
  }

  function animateControl(control) {
    const now = performance.now();
    let state = feedbackState.get(control) || { lastAt: 0, frame: 0, timer: 0 };
    if (now - state.lastAt < feedbackCooldownMs) return;

    state.lastAt = now;
    if (state.frame) cancelAnimationFrame(state.frame);
    if (state.timer) clearTimeout(state.timer);
    control.classList.remove('ui-click-feedback');
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      control.classList.add('ui-click-feedback');
      state.timer = window.setTimeout(() => {
        control.classList.remove('ui-click-feedback');
        state.timer = 0;
      }, 480);
    });
    feedbackState.set(control, state);
  }

  function showClickEffect(control, originX, originY) {
    animateControl(control);

    const now = performance.now();
    if (now - lastBurstAt < burstCooldownMs || activeParticles >= maxActiveParticles) return;
    lastBurstAt = now;

    const layer = getLayer(control);
    const host = layer.parentElement;
    const hostRect = host instanceof HTMLDialogElement ? host.getBoundingClientRect() : { left: 0, top: 0 };

    particles.forEach((symbol, index) => {
      if (activeParticles >= maxActiveParticles) return;
      const angle = (Math.PI * 2 * index) / particles.length + (Math.random() - 0.5) * 0.35;
      const distance = 34 + Math.random() * 28;
      const particle = document.createElement('span');
      particle.className = 'click-particle';
      particle.textContent = symbol;
      particle.style.left = `${originX - hostRect.left}px`;
      particle.style.top = `${originY - hostRect.top}px`;
      particle.style.setProperty('--particle-x', `${Math.cos(angle) * distance}px`);
      particle.style.setProperty('--particle-y', `${Math.sin(angle) * distance}px`);
      particle.style.setProperty('--particle-rotation', `${Math.round(Math.random() * 100 - 50)}deg`);
      particle.style.setProperty('--particle-scale', `${0.9 + Math.random() * 0.65}`);
      particle.style.setProperty('--particle-color', colors[index % colors.length]);
      activeParticles += 1;
      let removed = false;
      const removeParticle = () => {
        if (removed) return;
        removed = true;
        activeParticles = Math.max(0, activeParticles - 1);
        particle.remove();
      };
      particle.addEventListener('animationend', removeParticle, { once: true });
      window.setTimeout(removeParticle, 1100);
      layer.append(particle);
    });
  }

  document.addEventListener('click', (event) => {
    // Bubble after the activated control has handled its action, including
    // opening or closing a modal, so particles render in the visible top layer.
    if (!(event.target instanceof Element)) return;

    const control = event.target.closest(controlSelector);
    if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;

    const rect = control.getBoundingClientRect();
    const originX = event.detail ? event.clientX : rect.left + rect.width / 2;
    const originY = event.detail ? event.clientY : rect.top + rect.height / 2;
    showClickEffect(control, originX, originY);
  });
}

function bindButtonSounds() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const controlSelector = 'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"], a';
  let audioContext = null;
  let lastSoundAt = 0;
  const notes = {
    click: [
      { frequency: 700, at: 0, duration: 0.12, volume: 0.07 },
      { frequency: 1120, at: 0.035, duration: 0.11, volume: 0.022 }
    ],
    arrowNext: [
      { frequency: 520, at: 0, duration: 0.11, volume: 0.055 },
      { frequency: 760, at: 0.055, duration: 0.13, volume: 0.05 }
    ],
    arrowPrevious: [
      { frequency: 760, at: 0, duration: 0.11, volume: 0.05 },
      { frequency: 520, at: 0.055, duration: 0.13, volume: 0.055 }
    ],
    amountUp: [
      { frequency: 523, at: 0, duration: 0.1, volume: 0.045 },
      { frequency: 659, at: 0.05, duration: 0.11, volume: 0.05 },
      { frequency: 784, at: 0.1, duration: 0.14, volume: 0.05 }
    ],
    amountDown: [
      { frequency: 784, at: 0, duration: 0.1, volume: 0.05 },
      { frequency: 659, at: 0.05, duration: 0.11, volume: 0.05 },
      { frequency: 523, at: 0.1, duration: 0.14, volume: 0.045 }
    ],
    modalOpen: [
      { frequency: 440, at: 0, duration: 0.17, volume: 0.04 },
      { frequency: 587, at: 0.065, duration: 0.17, volume: 0.042 },
      { frequency: 784, at: 0.13, duration: 0.2, volume: 0.045 }
    ],
    modalClose: [
      { frequency: 784, at: 0, duration: 0.16, volume: 0.045 },
      { frequency: 587, at: 0.065, duration: 0.16, volume: 0.042 },
      { frequency: 440, at: 0.13, duration: 0.18, volume: 0.04 }
    ],
    cartAdd: [
      { frequency: 587, at: 0, duration: 0.12, volume: 0.05 },
      { frequency: 740, at: 0.055, duration: 0.14, volume: 0.05 },
      { frequency: 988, at: 0.11, duration: 0.2, volume: 0.05 }
    ],
    cartOpen: [
      { frequency: 494, at: 0, duration: 0.14, volume: 0.045 },
      { frequency: 659, at: 0.065, duration: 0.16, volume: 0.045 }
    ]
  };

  function resolveSoundType(control) {
    if (control.matches('.arrow-right')) return 'arrowNext';
    if (control.matches('.arrow-left')) return 'arrowPrevious';
    if (control.matches('#quantityIncrease')) return 'amountUp';
    if (control.matches('#quantityDecrease')) return 'amountDown';
    if (control.matches('#buyButton')) return 'cartAdd';
    if (control.matches('#socialConfirmContinue')) return null;
    if (control.matches('[data-close-dialog]')) return null;
    if (control.matches('.cookie-card')) return 'modalOpen';
    if (control.matches('.cart-button')) return 'cartOpen';
    return 'click';
  }

  function playSound(type) {
    const pattern = notes[type];
    if (!pattern || !audioContext) return;

    const start = audioContext.currentTime;
    const master = audioContext.createGain();
    master.gain.setValueAtTime(0.58, start);
    master.connect(audioContext.destination);
    let remaining = pattern.length;

    pattern.forEach((note) => {
      const noteStart = start + note.at;
      const oscillator = audioContext.createOscillator();
      const envelope = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(note.frequency * (0.99 + Math.random() * 0.02), noteStart);
      envelope.gain.setValueAtTime(0.0001, noteStart);
      envelope.gain.exponentialRampToValueAtTime(note.volume, noteStart + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, noteStart + note.duration);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.addEventListener('ended', () => {
        remaining -= 1;
        if (remaining === 0) master.disconnect();
      }, { once: true });
      oscillator.start(noteStart);
      oscillator.stop(noteStart + note.duration + 0.015);
    });
  }

  function requestSound(type, force = false) {
    if (!type) return;
    const now = performance.now();
    if (!force && now - lastSoundAt < 85) return;
    lastSoundAt = now;

    try {
      audioContext ||= new AudioContextClass();
      if (audioContext.state === 'suspended') {
        audioContext.resume().then(() => playSound(type)).catch(() => {});
      } else {
        playSound(type);
      }
    } catch {
      // Sound is optional; the control action should always keep working.
    }
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const control = event.target.closest(controlSelector);
    if (!control || control.matches(':disabled, [aria-disabled="true"]')) return;
    requestSound(resolveSoundType(control));
  }, true);

  [productDialog, cartDialog].filter(Boolean).forEach((dialog) => {
    dialog.addEventListener('close', () => requestSound('modalClose'));
  });
  socialConfirmDialog?.addEventListener('close', () => requestSound('modalClose', true));
}

async function init() {
  bindButtonSounds();
  bindClickAnimations();
  bindSocialActionNotices();
  bindHeroDisplayWordFit();

  try {
    catalogCookies = await loadCookiesFromXml();
    const heroCookies = catalogCookies.filter((product) => product.heroCookie);
    products = heroCookies.length ? heroCookies : [...sampleProducts];
  } catch (error) {
    console.info('Using the built-in sample cookies because Cookies.xml could not be loaded.', error);
    catalogCookies = [...sampleProducts];
    products = [...sampleProducts];
  }

  try {
    const savedProductId = localStorage.getItem('selahHeroProductId');
    const savedIndex = products.findIndex((product) => product.id === savedProductId);
    if (savedIndex >= 0) activeIndex = savedIndex;
  } catch {
    // Keep the first cookie selected when browser storage is unavailable.
  }

  updateProduct(products[activeIndex]);
  renderPagination();
  renderCookieCatalog();
  bindCookieGridScrollbar();
  bindArrowControls();
  bindShoppingControls();
  bindStickyMobileNav();
  bindStickyDesktopTopbar();
  bindDesktopWheelSmoothing();
  bindKeyboardControls();
  bindPointerControls();
  bindInteractionPause();

  if (!prefersReducedMotion) {
    restartAutoRotate();
  }

  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.documentElement.classList.remove('is-booting');
    document.documentElement.classList.add('is-ready');
  }));
}

init();
