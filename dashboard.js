const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 });
const countFormat = new Intl.NumberFormat('en-PH');
const byId = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const productImages = {
  'triple-chocolate-muffins': 'assets/cookies/tripleChocolateMuffins.png',
  'carrot-apple-muffins': 'assets/cookies/carrotAppleMuffins.png',
  'calamansi-muffins': 'assets/cookies/calamansiMuffins.png',
  'banana-chocolate-walnuts': 'assets/cookies/bananaChocolateWalnuts.png',
  'red-velvet-creamcheese': 'assets/cookies/redVelvetCreamCheese.png',
  'hazelnut-creamcheese': 'assets/cookies/hazelnutCreamCheese.png',
  'triple-biscoff': 'assets/cookies/tripleBiscoff.png',
  'midnight-cocoa': 'assets/cookies/midnightCocoa.png',
  brownies: 'assets/cookies/Brownies.png',
  'revel-bar': 'assets/cookies/revelBar.png'
};
const imageForProduct = (id) => productImages[id] || 'assets/cookies/Cookie1.png';
let storeProducts = [];
let productSortKey = 'clicks';
const productSortLabels = { clicks: 'Clicks', orders: 'Orders', adds: 'Add to cart' };
const svgNamespace = 'http://www.w3.org/2000/svg';
let dashboardData = null;
let activeChartMode = 'hours';
let chartAnimationFrame = 0;
let dashboardRequestId = 0;
const calendarViewMonths = { chart: null, customer: null };
let openCalendarType = null;
let customerPage = 1;
let customerPageCount = 1;
let customerQuery = '';
let customerRequestId = 0;
let customerSearchTimer = 0;
let customerActivityMode = '30days';
let customerActivityDate = '';
let chartMarkerResizeObserver = null;
const donutColors = ['#7f936a', '#d3a27d', '#8d819f', '#d6bf72', '#7a9d9a', '#bd8290', '#aaa78e'];
const customerSexLabels = { female: 'Female', male: 'Male', 'prefer-not-to-say': 'Prefer not to say' };

async function loadStoreProducts() {
  try {
    const response = await fetch('Cookies.xml', { cache: 'no-store' });
    if (!response.ok) throw new Error('Product catalog could not be loaded.');
    const xml = new DOMParser().parseFromString(await response.text(), 'application/xml');
    if (xml.querySelector('parsererror')) throw new Error('Product catalog is invalid.');
    storeProducts = [...xml.querySelectorAll('Cookies > Cookie')].map((node) => ({
      id: node.getAttribute('id') || '',
      name: node.querySelector('Name')?.textContent.trim() || 'Unnamed product',
      image: node.querySelector('Image')?.textContent.trim() || imageForProduct(node.getAttribute('id')),
      fallbackImage: node.querySelector('FallbackImage')?.textContent.trim() || 'assets/cookies/Cookie1.png',
      bgStart: node.querySelector('Background')?.getAttribute('start') || '#ede9df',
      bgEnd: node.querySelector('Background')?.getAttribute('end') || '#ddd7c8'
    })).filter((product) => product.id);
    renderProductCards();
  } catch (error) {
    byId('productStatsGrid').innerHTML = '<p class="product-empty-state">Product details could not be loaded.</p>';
  }
}

function renderProductCards() {
  const grid = byId('productStatsGrid');
  if (!grid || !storeProducts.length) return;
  const statsById = new Map((dashboardData?.productStats || []).map((item) => [item.id, item]));
  const products = [...storeProducts].sort((first, second) => {
    const a = Number(statsById.get(first.id)?.[productSortKey] || 0);
    const b = Number(statsById.get(second.id)?.[productSortKey] || 0);
    return b - a || first.name.localeCompare(second.name);
  });
  const existing = new Map([...grid.querySelectorAll(':scope > .product-stat-card')].map((card) => [card.dataset.productId, card]));
  const oldPositions = new Map([...existing.values()].map((card) => [card, card.getBoundingClientRect()]));
  const retained = new Set();
  const orderedCards = [];
  products.forEach((product, index) => {
    let card = existing.get(product.id);
    if (!card) {
      card = document.createElement('article');
      card.className = 'product-stat-card';
      card.dataset.productId = product.id;
      const heading = document.createElement('div');
      heading.className = 'product-stat-heading';
      const imageFrame = document.createElement('div');
      imageFrame.className = 'product-stat-image';
      imageFrame.style.background = `linear-gradient(145deg, ${product.bgStart}, ${product.bgEnd})`;
      const image = document.createElement('img');
      image.src = product.image;
      image.alt = '';
      image.loading = 'lazy';
      image.onerror = () => { image.src = product.fallbackImage; image.onerror = null; };
      imageFrame.append(image);
      const name = document.createElement('h2');
      name.textContent = product.name;
      heading.append(imageFrame, name);
      const metrics = document.createElement('div');
      metrics.className = 'product-stat-metrics';
      ['Clicks', 'Add to cart', 'Orders'].forEach((label) => {
        const metric = document.createElement('div');
        metric.className = 'product-stat-metric';
        const caption = document.createElement('span');
        caption.textContent = label;
        const total = document.createElement('strong');
        metric.append(caption, total);
        metrics.append(metric);
      });
      card.append(heading, metrics);
    }
    retained.add(product.id);
    orderedCards.push(card);
    const stats = statsById.get(product.id) || {};
    const values = [stats.clicks, stats.adds, stats.orders].map((value) => countFormat.format(Number(value || 0)));
    card.querySelectorAll('.product-stat-metric strong').forEach((total, metricIndex) => {
      if (total.textContent !== values[metricIndex]) total.textContent = values[metricIndex];
    });
    const currentAtIndex = grid.children[index];
    if (currentAtIndex !== card) grid.insertBefore(card, currentAtIndex || null);
  });
  for (const [productId, card] of existing) {
    if (!retained.has(productId)) card.remove();
  }
  grid.querySelector('.product-empty-state')?.remove();
  if (!reducedMotion) {
    orderedCards.forEach((card) => {
      const before = oldPositions.get(card);
      if (!before) return;
      const after = card.getBoundingClientRect();
      const x = before.left - after.left;
      const y = before.top - after.top;
      if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
      card.animate(
        [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0, 0)' }],
        { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' }
      );
    });
  }
}

function setCustomerText(element, value) {
  const text = String(value ?? '');
  if (element && element.textContent !== text) element.textContent = text;
}

function animateCustomerUpdate(element) {
  if (!element || reducedMotion || typeof element.animate !== 'function') return;
  element.animate(
    [{ opacity: 0.35, transform: 'translateY(7px)' }, { opacity: 1, transform: 'translateY(0)' }],
    { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }
  );
}

function setCustomerCardText(element, value, animate = true) {
  const text = String(value ?? '');
  if (!element || element.textContent === text) return false;
  element.textContent = text;
  if (animate) animateCustomerUpdate(element);
  return true;
}

function createCustomerCartRow(item) {
  const row = document.createElement('div');
  row.className = 'customer-cart-item';
  row.dataset.productId = String(item.id);
  row.innerHTML = '<img alt="" loading="lazy"><div class="customer-cart-item-copy"><strong></strong><div class="customer-cart-item-meta"><span class="customer-cart-item-state"></span><span data-cart-quantity></span></div></div><b></b>';
  return row;
}

function updateCustomerCartRow(row, item, animate = true) {
  const image = row.querySelector('img');
  const imageSource = imageForProduct(item.id);
  if (image.getAttribute('src') !== imageSource) image.src = imageSource;
  const name = row.querySelector('.customer-cart-item-copy > strong');
  setCustomerCardText(name, item.name, animate);
  name.title = item.name;
  const state = row.querySelector('.customer-cart-item-state');
  state.className = `customer-cart-item-state ${item.selected ? 'is-selected' : 'is-unselected'}`;
  setCustomerCardText(state, item.selected ? 'Selected' : 'Not selected', animate);
  setCustomerCardText(row.querySelector('[data-cart-quantity]'), `Qty ${countFormat.format(Number(item.quantity || 0))}`, animate);
  setCustomerCardText(row.querySelector('b'), peso.format(Number(item.price || 0) * Number(item.quantity || 0)), animate);
}

function renderCustomerCartItems(list, cartItems, animate = true) {
  const existing = new Map([...list.children].map((row) => [row.dataset.productId, row]));
  cartItems.forEach((item, index) => {
    const key = String(item.id);
    let row = existing.get(key);
    const isNew = !row;
    if (!row) row = createCustomerCartRow(item);
    existing.delete(key);
    updateCustomerCartRow(row, item, animate && !isNew);
    if (list.children[index] !== row) list.insertBefore(row, list.children[index] || null);
    if (isNew && animate) animateCustomerUpdate(row);
  });
  existing.forEach((row) => {
    if (!animate || reducedMotion || typeof row.animate !== 'function') {
      row.remove();
      return;
    }
    const exit = row.animate(
      [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-5px)' }],
      { duration: 220, easing: 'ease-in' }
    );
    exit.onfinish = () => row.remove();
  });
}

function renderCustomerKpis(summary) {
  const container = byId('customerKpis');
  if (!container.dataset.ready) {
    const definitions = [
      ['onlineUsers', 'Online now', 'Signed-in customer accounts seen in the past 75 seconds', 'user'],
      ['createdAccounts', 'Created accounts', 'All registered customer accounts', 'user'],
      ['trackedSpending', 'Tracked spending', 'Account-linked order requests', 'orders'],
      ['customersWithCart', 'Customers with a cart', 'Saved carts with items', 'products']
    ];
    container.replaceChildren(...definitions.map(([key, label, detail, icon]) => {
      const card = document.createElement('article');
      card.className = 'customer-kpi';
      card.innerHTML = `<div class="customer-kpi-label"><span>${label}</span><i class="customer-kpi-icon"><svg aria-hidden="true"><use href="assets/dashboard-icons.svg#${icon}"/></svg></i></div><strong data-kpi="${key}">0</strong><small>${detail}</small>`;
      return card;
    }));
    container.dataset.ready = 'true';
  }
  setCustomerText(container.querySelector('[data-kpi="onlineUsers"]'), countFormat.format(summary.onlineUsers));
  setCustomerText(container.querySelector('[data-kpi="createdAccounts"]'), countFormat.format(summary.createdAccounts));
  setCustomerText(container.querySelector('[data-kpi="trackedSpending"]'), peso.format(summary.trackedSpending));
  setCustomerText(container.querySelector('[data-kpi="customersWithCart"]'), countFormat.format(summary.customersWithCart));
}

function renderCustomerBars(containerId, items) {
  const container = byId(containerId);
  const max = Math.max(1, ...items.map((item) => Number(item.count || 0)));
  const existing = new Map([...container.querySelectorAll('.customer-chart-row')].map((row) => [row.dataset.key, row]));
  items.forEach((item, index) => {
    const key = String(item.name);
    let row = existing.get(key);
    if (!row) {
      row = document.createElement('div');
      row.className = 'customer-chart-row';
      row.dataset.key = key;
      row.innerHTML = '<span></span><div class="customer-chart-track"><i></i></div><b></b>';
    }
    existing.delete(key);
    setCustomerText(row.querySelector('span'), item.name);
    row.querySelector('span').title = item.name;
    setCustomerText(row.querySelector('b'), countFormat.format(Number(item.count || 0)));
    const width = `${Number(item.count || 0) / max * 100}%`;
    if (row.querySelector('i').style.width !== width) row.querySelector('i').style.width = width;
    if (container.children[index] !== row) container.insertBefore(row, container.children[index] || null);
  });
  existing.forEach((row) => row.remove());
}

function hideCustomerActiveTooltip(force = false) {
  const tooltip = byId('customerActiveTooltip');
  if (!tooltip || (!force && tooltip.dataset.pinned === 'true')) return;
  tooltip.hidden = true;
  tooltip.dataset.pinned = 'false';
  document.querySelectorAll('.customer-active-point[aria-pressed="true"]').forEach((point) => point.setAttribute('aria-pressed', 'false'));
}

function customerHourLabel(hour) {
  const normalized = ((Number(hour) % 24) + 24) % 24;
  const suffix = normalized < 12 ? 'AM' : 'PM';
  return `${normalized % 12 || 12} ${suffix}`;
}

function showCustomerActiveTooltip(entry, event, pin = false) {
  const tooltip = byId('customerActiveTooltip');
  const wrap = tooltip.parentElement;
  if (tooltip.dataset.pinned === 'true' && !pin) return;
  const date = new Date(`${entry.date}T12:00:00`);
  tooltip.querySelector('[data-active-date]').textContent = date.toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' });
  const periodLabel = tooltip.querySelector('[data-active-period]');
  periodLabel.hidden = !Number.isInteger(entry.hour);
  if (Number.isInteger(entry.hour)) periodLabel.textContent = `${customerHourLabel(entry.hour)} – ${customerHourLabel(entry.hour + 1)}`;
  tooltip.querySelector('[data-active-count]').textContent = countFormat.format(entry.count);
  const bounds = wrap.getBoundingClientRect();
  const triggerBounds = event?.currentTarget?.getBoundingClientRect?.();
  const x = Number.isFinite(event?.clientX) ? event.clientX - bounds.left : triggerBounds ? triggerBounds.left - bounds.left + triggerBounds.width / 2 : bounds.width / 2;
  const y = Number.isFinite(event?.clientY) ? event.clientY - bounds.top : triggerBounds ? triggerBounds.top - bounds.top : 32;
  const width = Math.min(192, bounds.width - 16);
  tooltip.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, x - width / 2))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(bounds.height - 94, y - 88))}px`;
  tooltip.dataset.pinned = String(pin);
  tooltip.dataset.key = `${entry.date}:${Number.isInteger(entry.hour) ? entry.hour : 'day'}`;
  if (pin) {
    document.querySelectorAll('.customer-active-point').forEach((point) => point.setAttribute('aria-pressed', String(point.dataset.pointKey === tooltip.dataset.key)));
  }
  tooltip.hidden = false;
}

function toggleCustomerActiveTooltip(entry, event) {
  const tooltip = byId('customerActiveTooltip');
  const key = `${entry.date}:${Number.isInteger(entry.hour) ? entry.hour : 'day'}`;
  if (tooltip.dataset.pinned === 'true' && tooltip.dataset.key === key) {
    hideCustomerActiveTooltip(true);
    return;
  }
  showCustomerActiveTooltip(entry, event, true);
}

function drawCustomerActiveChart(trend, mode = customerActivityMode, selectedDate = customerActivityDate) {
  const svg = byId('customerActiveChart');
  const entries = Array.isArray(trend) ? trend.map((item) => ({
    date: mode === 'day' ? selectedDate : String(item.date),
    ...(mode === 'day' ? { hour: Number(item.hour) } : {}),
    count: Number(item.count || 0)
  })) : [];
  if (!svg || !entries.length) return;
  const signature = `${mode}:${selectedDate}:${JSON.stringify(entries)}`;
  if (svg.dataset.signature === signature) return;
  hideCustomerActiveTooltip(true);
  svg.replaceChildren();

  const width = 760;
  const top = 26;
  const bottom = 190;
  const left = 48;
  const right = 744;
  const maximum = Math.max(...entries.map((entry) => entry.count), 4);
  const axisMaximum = Math.max(4, Math.ceil(maximum / 4) * 4);
  const pointY = (count) => bottom - count / axisMaximum * (bottom - top);
  const pointX = (index) => left + index * (right - left) / Math.max(1, entries.length - 1);
  const createSvgNode = (tag, attributes = {}, textContent = '') => {
    const node = document.createElementNS(svgNamespace, tag);
    Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, String(value)));
    if (textContent) node.textContent = textContent;
    return node;
  };

  const defs = createSvgNode('defs');
  const gradient = createSvgNode('linearGradient', { id: 'customerActiveFill', x1: '0', x2: '0', y1: '0', y2: '1' });
  gradient.append(
    createSvgNode('stop', { offset: '0%', 'stop-color': '#9bad86', 'stop-opacity': '.30' }),
    createSvgNode('stop', { offset: '70%', 'stop-color': '#9bad86', 'stop-opacity': '.08' }),
    createSvgNode('stop', { offset: '100%', 'stop-color': '#9bad86', 'stop-opacity': '0' })
  );
  defs.append(gradient);
  svg.append(defs);

  for (let tick = 0; tick <= 4; tick++) {
    const value = axisMaximum * tick / 4;
    const y = pointY(value);
    svg.append(
      createSvgNode('line', { class: tick === 0 ? 'customer-active-grid-line is-baseline' : 'customer-active-grid-line', x1: left, x2: right, y1: y, y2: y }),
      createSvgNode('text', { class: 'customer-active-axis-label', x: left - 11, y: y + 3, 'text-anchor': 'end' }, countFormat.format(Math.round(value)))
    );
  }

  const points = entries.map((entry, index) => ({ ...entry, x: pointX(index), y: pointY(entry.count) }));
  const formatPoint = (point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  let linePath = `M${formatPoint(points[0])}`;
  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[Math.max(0, index - 1)];
    const current = points[index];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const controlOne = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
    const controlTwo = { x: next.x - (after.x - current.x) / 6, y: next.y - (after.y - current.y) / 6 };
    linePath += ` C${formatPoint(controlOne)} ${formatPoint(controlTwo)} ${formatPoint(next)}`;
  }
  const areaPath = `${linePath} L${right},${bottom} L${left},${bottom} Z`;
  const area = createSvgNode('path', { class: 'customer-active-area', d: areaPath });
  const line = createSvgNode('path', { class: 'customer-active-line', d: linePath });
  svg.append(area, line);

  const dateIndexes = mode === 'day' ? [0, 4, 8, 12, 16, 20, 23] : [...new Set([0, Math.round((entries.length - 1) / 4), Math.round((entries.length - 1) / 2), Math.round((entries.length - 1) * 3 / 4), entries.length - 1])];
  dateIndexes.forEach((index, labelIndex) => {
    const anchor = labelIndex === 0 ? 'start' : labelIndex === dateIndexes.length - 1 ? 'end' : 'middle';
    const label = mode === 'day'
      ? customerHourLabel(index)
      : new Date(`${entries[index].date}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    svg.append(createSvgNode('text', { class: 'customer-active-date-label', x: pointX(index), y: 224, 'text-anchor': anchor }, label));
  });

  points.forEach((entry) => {
    const dateLabel = new Date(`${entry.date}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
    const pointKey = `${entry.date}:${Number.isInteger(entry.hour) ? entry.hour : 'day'}`;
    const pointLabel = Number.isInteger(entry.hour) ? `${dateLabel}, ${customerHourLabel(entry.hour)}` : dateLabel;
    const group = createSvgNode('g', { class: 'customer-active-point', tabindex: '0', role: 'button', 'aria-pressed': 'false', 'aria-describedby': 'customerActiveTooltip', 'aria-label': `${pointLabel}: ${countFormat.format(entry.count)} active accounts`, 'data-date': entry.date, 'data-point-key': pointKey });
    group.append(
      createSvgNode('ellipse', { class: 'customer-active-point-hit', cx: entry.x, cy: entry.y, rx: 10, ry: 10, 'data-screen-radius': 10 }),
      createSvgNode('ellipse', { class: 'customer-active-point-dot', cx: entry.x, cy: entry.y, rx: 3.2, ry: 3.2, 'data-screen-radius': 3.2 })
    );
    group.addEventListener('pointerenter', (event) => showCustomerActiveTooltip(entry, event));
    group.addEventListener('pointermove', (event) => showCustomerActiveTooltip(entry, event));
    group.addEventListener('pointerleave', () => {
      if (byId('customerActiveTooltip').dataset.pinned !== 'true' && document.activeElement !== group) hideCustomerActiveTooltip();
    });
    group.addEventListener('focus', () => showCustomerActiveTooltip(entry, { currentTarget: group }));
    group.addEventListener('blur', () => hideCustomerActiveTooltip());
    group.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleCustomerActiveTooltip(entry, event);
    });
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { hideCustomerActiveTooltip(true); group.blur(); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); group.click(); }
    });
    svg.append(group);
  });
  syncSvgMarkerSizes(svg);
  syncSvgTextAspect(svg);

  if (!reducedMotion && svg.dataset.introPlayed !== 'true') {
    const length = line.getTotalLength();
    line.style.strokeDasharray = `${length} ${length}`;
    const lineAnimation = line.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: 900, easing: 'cubic-bezier(.2,.75,.25,1)' });
    lineAnimation.onfinish = () => { line.style.removeProperty('stroke-dasharray'); line.style.removeProperty('stroke-dashoffset'); };
    area.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 720, easing: 'ease-out' });
    svg.querySelectorAll('.customer-active-point-dot').forEach((dot, index) => dot.animate([{ opacity: 0, transform: 'scale(.15)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 240, delay: Math.min(index * 18, 360), easing: 'ease-out' }));
  }
  svg.dataset.introPlayed = 'true';
  svg.dataset.signature = signature;
}

function syncSvgMarkerSizes(svg) {
  const viewBox = svg?.viewBox?.baseVal;
  const bounds = svg?.getBoundingClientRect();
  if (!viewBox?.width || !viewBox?.height || !bounds?.width || !bounds?.height) return;
  const scaleX = bounds.width / viewBox.width;
  const scaleY = bounds.height / viewBox.height;
  const activePoints = svg.querySelectorAll('.customer-active-point');
  const hitRadius = activePoints.length > 1 ? Math.min(10, bounds.width / (activePoints.length - 1) * .47) : 10;
  svg.querySelectorAll('[data-screen-radius]').forEach((marker) => {
    const maximumRadius = Number(marker.dataset.screenRadius);
    const screenRadius = marker.classList.contains('customer-active-point-hit') ? Math.min(maximumRadius, hitRadius) : maximumRadius;
    if (!Number.isFinite(screenRadius) || screenRadius <= 0) return;
    marker.setAttribute('rx', String(screenRadius / scaleX));
    marker.setAttribute('ry', String(screenRadius / scaleY));
  });
}

function syncSvgTextAspect(svg) {
  const viewBox = svg?.viewBox?.baseVal;
  const bounds = svg?.getBoundingClientRect();
  if (!viewBox?.width || !viewBox?.height || !bounds?.width || !bounds?.height) return;
  const scaleX = bounds.width / viewBox.width;
  const scaleY = bounds.height / viewBox.height;
  svg.querySelectorAll('text').forEach((label) => {
    const x = Number(label.getAttribute('x') || 0);
    const y = Number(label.getAttribute('y') || 0);
    label.setAttribute('transform', `translate(${x} ${y}) scale(${1 / scaleX} ${1 / scaleY}) translate(${-x} ${-y})`);
  });
}

function setupSvgMarkerSizing() {
  const svgs = [byId('salesChart'), byId('customerActiveChart')].filter(Boolean);
  svgs.forEach((svg) => { syncSvgMarkerSizes(svg); syncSvgTextAspect(svg); });
  if (typeof ResizeObserver !== 'function') return;
  chartMarkerResizeObserver = new ResizeObserver((entries) => entries.forEach(({ target }) => {
    syncSvgMarkerSizes(target);
    syncSvgTextAspect(target);
  }));
  svgs.forEach((svg) => chartMarkerResizeObserver.observe(svg));
}

function closeGenderPopover(force = false) {
  const popover = byId('genderPopover');
  if (!popover || (!force && popover.dataset.pinned === 'true')) return;
  popover.hidden = true;
  popover.dataset.pinned = 'false';
  document.querySelectorAll('.gender-data-trigger[aria-pressed="true"]').forEach((trigger) => trigger.setAttribute('aria-pressed', 'false'));
}

function showGenderPopover(entry, event, pin = false) {
  const popover = byId('genderPopover');
  const layout = byId('genderChartLayout');
  if (popover.dataset.pinned === 'true' && !pin) return;
  const total = Number(byId('genderTotal').dataset.value || 0);
  const count = Number(entry.count || 0);
  popover.querySelector('[data-sex-name]').textContent = entry.name;
  popover.querySelector('[data-sex-count]').textContent = countFormat.format(count);
  popover.querySelector('[data-sex-share]').textContent = `${total ? (count / total * 100).toFixed(1) : '0.0'}%`;
  const bounds = layout.getBoundingClientRect();
  const triggerBounds = event?.currentTarget?.getBoundingClientRect?.();
  const x = Number.isFinite(event?.clientX) ? event.clientX - bounds.left + 12 : triggerBounds ? triggerBounds.left - bounds.left + triggerBounds.width / 2 : bounds.width / 2;
  const y = Number.isFinite(event?.clientY) ? event.clientY - bounds.top + 10 : triggerBounds ? triggerBounds.top - bounds.top : 12;
  const width = Math.min(220, bounds.width - 16);
  popover.style.left = `${Math.max(8, Math.min(bounds.width - width - 8, x - width / 2))}px`;
  popover.style.top = `${Math.max(4, Math.min(bounds.height - 122, y - 22))}px`;
  popover.dataset.key = entry.key;
  popover.dataset.pinned = String(pin);
  if (pin) document.querySelectorAll('.gender-data-trigger').forEach((trigger) => trigger.setAttribute('aria-pressed', String(trigger.dataset.key === entry.key)));
  popover.hidden = false;
}

function wireGenderTrigger(trigger) {
  trigger.addEventListener('pointerenter', (event) => showGenderPopover(trigger.genderEntry, event));
  trigger.addEventListener('pointermove', (event) => showGenderPopover(trigger.genderEntry, event));
  trigger.addEventListener('pointerleave', () => {
    if (byId('genderPopover').dataset.pinned !== 'true' && document.activeElement !== trigger) closeGenderPopover();
  });
  trigger.addEventListener('focus', () => showGenderPopover(trigger.genderEntry, { currentTarget: trigger }));
  trigger.addEventListener('blur', () => closeGenderPopover());
  trigger.addEventListener('click', (event) => {
    event.stopPropagation();
    const samePinned = byId('genderPopover').dataset.pinned === 'true' && byId('genderPopover').dataset.key === trigger.genderEntry.key;
    if (samePinned) closeGenderPopover(true);
    else showGenderPopover(trigger.genderEntry, event, true);
  });
  trigger.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeGenderPopover(true); trigger.blur(); }
    else if (trigger.namespaceURI === svgNamespace && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); trigger.click(); }
  });
}

function drawGenderDistribution(entries, total, colors) {
  const svg = byId('genderChartSvg');
  const circumference = 2 * Math.PI * 52;
  let track = svg.querySelector('.gender-donut-track');
  if (!track) {
    track = document.createElementNS(svgNamespace, 'circle');
    track.setAttribute('class', 'gender-donut-track');
    track.setAttribute('cx', '70'); track.setAttribute('cy', '70'); track.setAttribute('r', '52');
    svg.append(track);
  }
  const existingSegments = new Map([...svg.querySelectorAll('.gender-donut-segment')].map((segment) => [segment.dataset.key, segment]));
  let offset = 0;
  entries.forEach((entry) => {
    let segment = existingSegments.get(entry.key);
    if (!entry.count) {
      segment?.remove();
      existingSegments.delete(entry.key);
      return;
    }
    if (!segment) {
      segment = document.createElementNS(svgNamespace, 'circle');
      segment.setAttribute('class', 'gender-donut-segment gender-data-trigger');
      segment.setAttribute('cx', '70'); segment.setAttribute('cy', '70'); segment.setAttribute('r', '52');
      segment.setAttribute('transform', 'rotate(-90 70 70)');
      segment.setAttribute('stroke-width', '15');
      segment.setAttribute('tabindex', '0'); segment.setAttribute('role', 'button'); segment.setAttribute('aria-pressed', 'false');
      segment.setAttribute('aria-describedby', 'genderPopover');
      segment.dataset.key = entry.key;
      wireGenderTrigger(segment);
      svg.append(segment);
    }
    existingSegments.delete(entry.key);
    segment.genderEntry = entry;
    const share = entry.count / total;
    const length = circumference * share;
    const gap = Math.min(2.5, length * .14);
    segment.style.stroke = colors[entry.key];
    segment.style.strokeDasharray = `${Math.max(0, length - gap)} ${circumference - Math.max(0, length - gap)}`;
    segment.style.strokeDashoffset = String(-offset);
    segment.setAttribute('aria-label', `${entry.name}: ${countFormat.format(entry.count)} accounts, ${(share * 100).toFixed(1)} percent`);
    const title = document.createElementNS(svgNamespace, 'title');
    title.textContent = `${entry.name}: ${countFormat.format(entry.count)} accounts · ${(share * 100).toFixed(1)}%`;
    segment.querySelector('title')?.remove(); segment.append(title);
    offset += length;
  });
  existingSegments.forEach((segment) => segment.remove());

  const legend = byId('genderLegend');
  const existingRows = new Map([...legend.children].map((row) => [row.dataset.key, row]));
  entries.forEach((entry, index) => {
    let row = existingRows.get(entry.key);
    if (!row) {
      row = document.createElement('button');
      row.type = 'button'; row.className = 'gender-legend-row gender-data-trigger'; row.dataset.key = entry.key;
      row.setAttribute('aria-pressed', 'false'); row.setAttribute('aria-describedby', 'genderPopover');
      row.innerHTML = '<i></i><span></span><strong></strong>';
      wireGenderTrigger(row);
    }
    existingRows.delete(entry.key);
    row.genderEntry = entry;
    row.querySelector('i').style.background = colors[entry.key];
    setCustomerText(row.querySelector('span'), entry.name);
    setCustomerText(row.querySelector('strong'), countFormat.format(entry.count));
    const percent = total ? (entry.count / total * 100).toFixed(1) : '0.0';
    row.setAttribute('aria-label', `${entry.name}: ${countFormat.format(entry.count)} accounts, ${percent} percent`);
    if (legend.children[index] !== row) legend.insertBefore(row, legend.children[index] || null);
  });
  existingRows.forEach((row) => row.remove());

  const popover = byId('genderPopover');
  if (!popover.hidden) {
    const current = entries.find((entry) => entry.key === popover.dataset.key);
    if (current) showGenderPopover(current, null, popover.dataset.pinned === 'true');
    else closeGenderPopover(true);
  }
}

function renderCustomerSummary(summary) {
  renderCustomerKpis(summary);
  updateCustomerActivityMode();
  const activeTrend = customerActivityMode === 'day' ? summary.activeUserHourlyTrend : summary.activeUserTrend;
  drawCustomerActiveChart(activeTrend || [], customerActivityMode, customerActivityDate);
  const sexEntries = Object.entries(customerSexLabels).map(([key, name]) => ({ key, name, count: Number(summary.sex?.[key] || 0) }));
  const total = sexEntries.reduce((sum, entry) => sum + entry.count, 0);
  setCustomerText(byId('genderTotal'), countFormat.format(total));
  byId('genderTotal').dataset.value = String(total);
  byId('genderDonut').setAttribute('aria-label', `Gender distribution across ${countFormat.format(total)} customer accounts`);
  const colors = { female: '#83966d', male: '#c58e75', 'prefer-not-to-say': '#aaa4bc' };
  drawGenderDistribution(sexEntries, total, colors);
  renderCustomerBars('ageChart', Object.entries(summary.ages || {}).map(([name, count]) => ({ name, count: Number(count) })));
  renderCustomerBars('locationChart', (summary.locations || []).map((item) => ({ name: item.name, count: Number(item.count) })));
}

function createCustomerCard(id) {
  const card = document.createElement('article');
  card.className = 'customer-card';
  card.dataset.customerId = String(id);
  card.innerHTML = '<div class="customer-card-head"><span class="customer-initials"></span><div class="customer-identity"><strong data-customer="name"></strong><span data-customer="username"></span></div><div class="customer-spend"><small>Total spent</small><strong data-customer="spend"></strong></div></div><div class="customer-facts"><span class="customer-fact" data-customer="age"></span><span class="customer-fact" data-customer="sex"></span><span class="customer-fact" data-customer="location"></span><span class="customer-fact" data-customer="joined"></span></div><div class="customer-favorites"><div class="customer-favorite"><small>Most clicked</small><strong data-customer="clicked"></strong></div><div class="customer-favorite"><small>Most ordered</small><strong data-customer="ordered"></strong></div></div><div class="customer-cart"><div class="customer-cart-heading"><strong>Current cart</strong><span data-customer="cartSummary"></span></div><div class="customer-cart-list"></div><p class="customer-cart-empty" hidden>No saved cart items.</p></div>';
  return card;
}

function renderCustomerCards(customers) {
  const container = byId('customerCards');
  container.classList.toggle('is-single', customers.length === 1);
  const existing = new Map([...container.querySelectorAll(':scope > .customer-card')].map((card) => [card.dataset.customerId, card]));
  customers.forEach((customer, index) => {
    const key = String(customer.id);
    let card = existing.get(key);
    const isNewCard = !card;
    if (isNewCard) card = createCustomerCard(customer.id);
    existing.delete(key);
    const words = customer.name.split(/\s+/).filter(Boolean);
    setCustomerCardText(card.querySelector('.customer-initials'), words.slice(0, 2).map((word) => word[0]).join('').toUpperCase() || 'C', !isNewCard);
    const customerName = card.querySelector('[data-customer="name"]');
    setCustomerCardText(customerName, customer.name || 'Customer', !isNewCard);
    customerName.title = customer.name || 'Customer';
    const username = card.querySelector('[data-customer="username"]');
    setCustomerCardText(username, `@${customer.username}`, !isNewCard);
    username.title = `@${customer.username}`;
    setCustomerCardText(card.querySelector('[data-customer="spend"]'), peso.format(Number(customer.totalSpent || 0)), !isNewCard);
    setCustomerCardText(card.querySelector('[data-customer="age"]'), customer.age ? `${customer.age} years old` : 'Age not provided', !isNewCard);
    setCustomerCardText(card.querySelector('[data-customer="sex"]'), customerSexLabels[customer.sex] || 'Not provided', !isNewCard);
    const location = card.querySelector('[data-customer="location"]');
    setCustomerCardText(location, customer.location || 'Location not provided', !isNewCard);
    location.title = customer.location || 'Location not provided';
    const joined = new Date(String(customer.createdAt).replace(' ', 'T') + '+08:00');
    setCustomerCardText(card.querySelector('[data-customer="joined"]'), Number.isNaN(joined.getTime()) ? '' : `Joined ${joined.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' })}`, !isNewCard);
    const mostClicked = card.querySelector('[data-customer="clicked"]');
    setCustomerCardText(mostClicked, customer.mostClicked || 'No tracked clicks', !isNewCard);
    mostClicked.title = customer.mostClicked || 'No tracked clicks';
    const mostOrdered = card.querySelector('[data-customer="ordered"]');
    setCustomerCardText(mostOrdered, customer.mostOrdered || 'No tracked orders', !isNewCard);
    mostOrdered.title = customer.mostOrdered || 'No tracked orders';
    const cartItems = [...(customer.cart?.selected || []).map((item) => ({ ...item, selected: true })), ...(customer.cart?.unselected || []).map((item) => ({ ...item, selected: false }))];
    const cartCount = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const selectedCount = (customer.cart?.selected || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const unselectedCount = (customer.cart?.unselected || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    setCustomerCardText(card.querySelector('[data-customer="cartSummary"]'), `${cartCount} item${cartCount === 1 ? '' : 's'} · ${selectedCount} selected / ${unselectedCount} not selected`, !isNewCard);
    const list = card.querySelector('.customer-cart-list');
    renderCustomerCartItems(list, cartItems, !isNewCard);
    const emptyCart = card.querySelector('.customer-cart-empty');
    const wasEmptyCartHidden = emptyCart.hidden;
    emptyCart.hidden = cartItems.length > 0;
    if (!isNewCard && wasEmptyCartHidden && !emptyCart.hidden) animateCustomerUpdate(emptyCart);
    if (container.children[index] !== card) container.insertBefore(card, container.children[index] || null);
    if (isNewCard) animateCustomerUpdate(card);
  });
  existing.forEach((card) => card.remove());
  container.querySelector('.customer-empty')?.remove();
  if (!customers.length) {
    const empty = document.createElement('p');
    empty.className = 'customer-empty';
    empty.textContent = customerQuery ? 'No customer accounts match this search.' : 'No customer accounts have been created yet.';
    container.append(empty);
  }
}

async function loadCustomerPage(page = customerPage, query = customerQuery) {
  const requestId = ++customerRequestId;
  customerPage = Math.max(1, page);
  customerQuery = query;
  byId('customerError').hidden = true;
  try {
    const params = new URLSearchParams({
      page: String(customerPage),
      q: customerQuery,
      activity_mode: customerActivityMode,
      activity_date: customerActivityDate
    });
    const response = await fetch(`api/dashboard-customers.php?${params}`, { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json();
    if (requestId !== customerRequestId) return;
    if (response.status === 401 || !response.ok || !result.ok) throw new Error(result.message || 'Customer insights could not be loaded.');
    renderCustomerSummary(result.summary);
    renderCustomerCards(result.customers);
    customerPage = Number(result.pagination.page);
    customerPageCount = Number(result.pagination.totalPages);
    byId('customerPrevious').disabled = customerPage <= 1;
    byId('customerNext').disabled = customerPage >= customerPageCount;
    setCustomerText(byId('customerPageStatus'), `Page ${customerPage} of ${customerPageCount}`);
    const first = result.pagination.total ? (customerPage - 1) * result.pagination.pageSize + 1 : 0;
    const last = Math.min(customerPage * result.pagination.pageSize, result.pagination.total);
    setCustomerText(byId('customerResultsMeta'), `${first}–${last} of ${countFormat.format(result.pagination.total)} accounts`);
    const updatedAt = new Date(result.updatedAt);
    setCustomerText(byId('customerUpdated'), `Updated ${updatedAt.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })} · Online means seen within 75 seconds`);
  } catch (error) {
    if (requestId === customerRequestId) {
      byId('customerError').textContent = error.message || 'Customer insights could not be loaded.';
      byId('customerError').hidden = false;
    }
  }
}

function setupCustomerPage() {
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && !event.target.closest('#genderChartLayout')) closeGenderPopover(true);
    if (event.target instanceof Element && !event.target.closest('.customer-active-chart-wrap')) hideCustomerActiveTooltip(true);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeGenderPopover(true);
      hideCustomerActiveTooltip(true);
    }
  });
  byId('customerSearch').addEventListener('input', () => {
    window.clearTimeout(customerSearchTimer);
    customerSearchTimer = window.setTimeout(() => loadCustomerPage(1, byId('customerSearch').value.trim()), 260);
  });
  byId('customerPrevious').addEventListener('click', () => loadCustomerPage(customerPage - 1));
  byId('customerNext').addEventListener('click', () => loadCustomerPage(customerPage + 1));
  const activityDateInput = byId('customerActivityDate');
  customerActivityDate = localDateKey(new Date());
  activityDateInput.max = customerActivityDate;
  activityDateInput.value = customerActivityDate;
  byId('customerActivityDateLabel').textContent = formatCalendarDate(customerActivityDate);
  updateCustomerActivityMode();
  document.querySelectorAll('[data-customer-chart-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      customerActivityMode = button.dataset.customerChartMode === 'day' ? 'day' : '30days';
      document.querySelectorAll('[data-customer-chart-mode]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      updateCustomerActivityMode();
      loadCustomerPage(customerPage, customerQuery);
    });
  });
  activityDateInput.addEventListener('change', () => {
    if (!activityDateInput.value) return;
    customerActivityDate = activityDateInput.value;
    loadCustomerPage(customerPage, customerQuery);
  });
}

function updateCustomerActivityMode() {
  const isDay = customerActivityMode === 'day';
  byId('customerActivityDateWrap').hidden = !isDay;
  setCustomerText(byId('customerActivityKicker'), isDay ? 'HOURLY ACTIVITY · SELECTED DAY' : 'DAILY ACTIVITY · LAST 30 DAYS');
  setCustomerText(byId('customerActivityChartTitle'), isDay ? 'Active users by hour' : 'Active users over time');
  setCustomerText(byId('customerActivityNote'), isDay
    ? 'Unique customer accounts with tracked activity in each hour on this date. Anonymous visits are not included. This measures activity, not who is online right now.'
    : 'Daily unique customer accounts with tracked product views, cart updates, or order requests. Anonymous visits are not included. This measures activity, not who is online right now.');
  byId('customerActiveChart').setAttribute('aria-label', isDay
    ? 'Unique active customer accounts by hour from 12 AM to 11 PM'
    : 'Daily unique active customer accounts over the last 30 days');
}

function setProductSort(key) {
  if (!Object.hasOwn(productSortLabels, key)) return;
  productSortKey = key;
  byId('productSortLabel').textContent = productSortLabels[key];
  document.querySelectorAll('[data-product-sort]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.productSort === key));
  });
  byId('productSortMenu').hidden = true;
  byId('productSortButton').setAttribute('aria-expanded', 'false');
  renderProductCards();
}

function setupProductPage() {
  const dateInput = byId('productDate');
  dateInput.max = byId('chartDate').max;
  dateInput.value = byId('chartDate').value;
  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    byId('chartDate').value = dateInput.value;
    byId('chartDate').dispatchEvent(new Event('change', { bubbles: true }));
  });
  byId('productSortButton').addEventListener('click', () => {
    const menu = byId('productSortMenu');
    menu.hidden = !menu.hidden;
    byId('productSortButton').setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.querySelectorAll('[data-product-sort]').forEach((button) => {
    button.addEventListener('click', () => setProductSort(button.dataset.productSort));
  });
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && !event.target.closest('.product-sort-wrap')) {
      byId('productSortMenu').hidden = true;
      byId('productSortButton').setAttribute('aria-expanded', 'false');
    }
  });
  byId('productSortButton').addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      byId('productSortMenu').hidden = true;
      byId('productSortButton').setAttribute('aria-expanded', 'false');
    }
  });
}

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatCalendarDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', options);
}

const calendarControls = {
  chart: {
    wrapper: 'chartDatePicker', input: 'chartDate', button: 'chartDateButton', label: 'chartDateLabel',
    calendar: 'chartCalendar', month: 'calendarMonth', selected: 'calendarSelectedLabel',
    previous: 'calendarPrevious', next: 'calendarNext', today: 'calendarToday', days: 'calendarDays'
  },
  customer: {
    wrapper: 'customerActivityDateWrap', input: 'customerActivityDate', button: 'customerActivityDateButton', label: 'customerActivityDateLabel',
    calendar: 'customerActivityCalendar', month: 'customerActivityCalendarMonth', selected: 'customerActivityCalendarSelected',
    previous: 'customerActivityCalendarPrevious', next: 'customerActivityCalendarNext', today: 'customerActivityCalendarToday', days: 'customerActivityCalendarDays'
  }
};

function renderCalendar(type = 'chart') {
  const ids = calendarControls[type];
  const input = byId(ids.input);
  const currentMonth = calendarViewMonths[type];
  const today = new Date(`${input.max}T12:00:00`);
  if (!currentMonth) calendarViewMonths[type] = new Date(new Date(`${input.value}T12:00:00`).getFullYear(), new Date(`${input.value}T12:00:00`).getMonth(), 1);
  const month = calendarViewMonths[type];
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`;
  byId(ids.month).textContent = month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  byId(ids.selected).textContent = `Selected · ${formatCalendarDate(input.value)}`;
  byId(ids.next).disabled = month.getFullYear() === today.getFullYear() && month.getMonth() >= today.getMonth();
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const key = localDateKey(date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'calendar-day';
    button.textContent = String(date.getDate());
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', date.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    button.classList.toggle('is-outside', date.getMonth() !== month.getMonth());
    button.classList.toggle('is-selected', key === input.value);
    button.classList.toggle('is-today', key === input.max);
    button.disabled = key > input.max;
    button.addEventListener('click', () => {
      input.value = key;
      byId(ids.label).textContent = formatCalendarDate(key);
      calendarViewMonths[type] = new Date(date.getFullYear(), date.getMonth(), 1);
      renderCalendar(type);
      closeCalendar(type);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return button;
  });
  byId(ids.days).replaceChildren(...days);
  byId(ids.days).dataset.month = monthKey;
}

function openCalendar(type = 'chart') {
  if (openCalendarType && openCalendarType !== type) closeCalendar(openCalendarType);
  const ids = calendarControls[type];
  const selectedDate = new Date(`${byId(ids.input).value}T12:00:00`);
  calendarViewMonths[type] = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  openCalendarType = type;
  renderCalendar(type);
  byId(ids.calendar).hidden = false;
  byId(ids.button).setAttribute('aria-expanded', 'true');
}

function closeCalendar(type = openCalendarType) {
  if (!type || !calendarControls[type]) return;
  const ids = calendarControls[type];
  byId(ids.calendar).hidden = true;
  byId(ids.button).setAttribute('aria-expanded', 'false');
  if (openCalendarType === type) openCalendarType = null;
}

function setupCalendar() {
  Object.entries(calendarControls).forEach(([type, ids]) => {
    byId(ids.button).addEventListener('click', () => {
      if (byId(ids.calendar).hidden) openCalendar(type);
      else closeCalendar(type);
    });
    byId(ids.previous).addEventListener('click', () => {
      calendarViewMonths[type].setMonth(calendarViewMonths[type].getMonth() - 1);
      renderCalendar(type);
    });
    byId(ids.next).addEventListener('click', () => {
      calendarViewMonths[type].setMonth(calendarViewMonths[type].getMonth() + 1);
      renderCalendar(type);
    });
    byId(ids.today).addEventListener('click', () => {
      byId(ids.input).value = byId(ids.input).max;
      byId(ids.label).textContent = formatCalendarDate(byId(ids.input).value);
      closeCalendar(type);
      byId(ids.input).dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  document.addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof Element)) return;
    Object.entries(calendarControls).forEach(([type, ids]) => {
      if (!byId(ids.wrapper).contains(event.target)) closeCalendar(type);
    });
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !openCalendarType) return;
    const ids = calendarControls[openCalendarType];
    closeCalendar(openCalendarType);
    byId(ids.button).focus();
  });
}

function setLocalDate() {
  const now = new Date();
  byId('todayLabel').textContent = now.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  byId('dayLabel').textContent = now.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  byId('chartDate').max = today;
  byId('chartDate').value = today;
  byId('chartDateLabel').textContent = formatCalendarDate(today);
}

function setupThemeToggle() {
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll('[data-theme-toggle]')];
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const updateButtons = () => {
    const dark = root.dataset.theme === 'dark';
    if (themeColor) themeColor.content = dark ? '#111410' : '#f5f3ee';
    buttons.forEach((button) => {
      const label = dark ? 'Switch to light theme' : 'Switch to dark theme';
      button.setAttribute('aria-label', label);
      button.title = label;
      button.setAttribute('aria-pressed', String(dark));
    });
  };

  updateButtons();
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const radius = Math.ceil(Math.max(
        Math.hypot(x, y),
        Math.hypot(window.innerWidth - x, y),
        Math.hypot(x, window.innerHeight - y),
        Math.hypot(window.innerWidth - x, window.innerHeight - y)
      ));
      root.style.setProperty('--theme-x', `${x}px`);
      root.style.setProperty('--theme-y', `${y}px`);
      root.style.setProperty('--theme-radius', `${radius}px`);
      const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      const applyTheme = () => {
        root.dataset.theme = nextTheme;
        try {
          localStorage.setItem('selahDashboardTheme', nextTheme);
        } catch {}
        updateButtons();
      };

      if (!reducedMotion && document.startViewTransition) {
        const transition = document.startViewTransition(() => {
          root.dataset.themeTransitioning = 'true';
          applyTheme();
        });
        const clearTransitionState = () => delete root.dataset.themeTransitioning;
        transition.finished.then(clearTransitionState, clearTransitionState);
      } else {
        applyTheme();
      }
    });
  });
}

function animateValue(element, target, formatter, duration = 650) {
  const end = Number(target) || 0;
  const activeTarget = Number(element.dataset.current || 0);
  if (activeTarget === end && element.dataset.current !== undefined) return;
  const start = Number(element.dataset.displayCurrent ?? activeTarget);
  element.dataset.current = String(end);
  const activeFrame = Number(element.dataset.animationFrame || 0);
  if (activeFrame) cancelAnimationFrame(activeFrame);
  if (reducedMotion || start === end) {
    const text = formatter(end);
    if (element.textContent !== text) element.textContent = text;
    element.dataset.displayCurrent = String(end);
    element.dataset.animationFrame = '';
    return;
  }
  const began = performance.now();
  const step = (time) => {
    const progress = Math.min(1, (time - began) / duration);
    const eased = 1 - (1 - progress) ** 3;
    const current = start + (end - start) * eased;
    const text = formatter(current);
    if (element.textContent !== text) element.textContent = text;
    element.dataset.displayCurrent = String(current);
    if (progress < 1) element.dataset.animationFrame = String(requestAnimationFrame(step));
    else element.dataset.animationFrame = '';
  };
  element.dataset.animationFrame = String(requestAnimationFrame(step));
}

function changeLabel(element, amount, currency = false) {
  const value = Number(amount || 0);
  const prefix = value > 0 ? '+' : '';
  element.textContent = `${prefix}${currency ? peso.format(value) : countFormat.format(value)}`;
  element.className = `trend ${value < 0 ? 'negative' : value === 0 ? 'neutral' : ''}`;
}

function hourLabel(hour) {
  const start = new Date();
  start.setHours(hour, 0, 0, 0);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const format = (date) => date.toLocaleTimeString('en-PH', { hour: 'numeric' });
  return `${format(start)} – ${format(end)}`;
}

function showChartTooltip(dot, event) {
  const tooltip = byId('chartTooltip');
  const wrap = tooltip.parentElement;
  const bounds = wrap.getBoundingClientRect();
  const point = dot.chartPoint;
  const x = event?.clientX ? event.clientX - bounds.left : dot.getBoundingClientRect().left - bounds.left + dot.getBoundingClientRect().width / 2;
  tooltip.innerHTML = `<strong>${point.label}</strong><span>${countFormat.format(point.orders)} order${point.orders === 1 ? '' : 's'} · ${peso.format(point.sales)}</span>`;
  tooltip.style.left = `${Math.max(78, Math.min(bounds.width - 78, x))}px`;
  tooltip.hidden = false;
}

function drawChart(data, mode = activeChartMode) {
  const svg = byId('salesChart');
  const chartScroll = byId('chartScroll');
  const dates = new Map((data.week || []).map((entry) => [entry.day, entry]));
  let entries;
  if (mode === 'hours') {
    const byHour = new Map((data.hours || []).map((entry) => [Number(entry.hour), entry]));
    entries = Array.from({ length: 24 }, (_, hour) => {
      const row = byHour.get(hour) || {};
      return { label: hourLabel(hour), sales: Number(row.sales || 0), orders: Number(row.orders || 0), hour };
    });
  } else {
    entries = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(`${(data.selectedDate || byId('chartDate').value)}T12:00:00`);
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const row = dates.get(key) || {};
      return { label: date.toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' }), axis: date.toLocaleDateString('en-PH', { weekday: 'short' }), sales: Number(row.sales || 0), orders: Number(row.orders || 0) };
    });
  }
  const values = entries.map((entry) => entry.sales);
  const max = Math.max(...values, 100);
  const chartWidth = mode === 'hours' ? 23 * 72 + 60 : 720;
  const viewBox = `0 0 ${chartWidth} 230`;
  if (svg.getAttribute('viewBox') !== viewBox) svg.setAttribute('viewBox', viewBox);
  if (svg.getAttribute('preserveAspectRatio') !== 'none') svg.setAttribute('preserveAspectRatio', 'none');
  const svgWidth = mode === 'hours' ? `${chartWidth}px` : '100%';
  if (svg.style.width !== svgWidth) svg.style.width = svgWidth;
  if (chartScroll.dataset.mode !== mode) chartScroll.dataset.mode = mode;
  const contentWidth = mode === 'hours' ? `${chartWidth}px` : '100%';
  if (byId('chartDays').style.width !== contentWidth) byId('chartDays').style.width = contentWidth;
  const points = values.map((value, i) => ({ x: 30 + i * (chartWidth - 60) / (values.length - 1), y: 188 - (value / max) * 150 }));
  if (!svg.querySelector('.chart-line')) {
    svg.innerHTML = `<defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#9bad86" stop-opacity=".28"/><stop offset="75%" stop-color="#9bad86" stop-opacity=".08"/><stop offset="100%" stop-color="#9bad86" stop-opacity="0"/></linearGradient></defs><line class="chart-grid-line" x1="28" y1="38" x2="690" y2="38"/><line class="chart-grid-line" x1="28" y1="88" x2="690" y2="88"/><line class="chart-grid-line" x1="28" y1="138" x2="690" y2="138"/><line class="chart-grid-line chart-baseline" x1="28" y1="188" x2="690" y2="188"/><path class="chart-area"/><path class="chart-line"/><g class="chart-point-layer"></g>`;
  }
  svg.querySelectorAll('.chart-grid-line').forEach((line) => {
    const end = String(chartWidth - 28);
    if (line.getAttribute('x2') !== end) line.setAttribute('x2', end);
  });
  const layer = svg.querySelector('.chart-point-layer');
  let dots = [...layer.querySelectorAll('.chart-dot')];
  if (dots.length !== entries.length) {
    layer.replaceChildren(...entries.map(() => {
      const dot = document.createElementNS(svgNamespace, 'ellipse');
      dot.classList.add('chart-dot');
      dot.setAttribute('rx', '3.2');
      dot.setAttribute('ry', '3.2');
      dot.dataset.screenRadius = '3.2';
      dot.setAttribute('tabindex', '0');
      dot.setAttribute('role', 'button');
      dot.addEventListener('pointerenter', (event) => showChartTooltip(dot, event));
      dot.addEventListener('pointermove', (event) => showChartTooltip(dot, event));
      dot.addEventListener('pointerleave', () => { byId('chartTooltip').hidden = true; });
      dot.addEventListener('focus', () => showChartTooltip(dot));
      dot.addEventListener('blur', () => { byId('chartTooltip').hidden = true; });
      dot.addEventListener('keydown', (event) => { if (event.key === 'Escape') { byId('chartTooltip').hidden = true; dot.blur(); } });
      return dot;
    }));
    dots = [...layer.querySelectorAll('.chart-dot')];
  }
  dots.forEach((dot, index) => {
    const entry = entries[index];
    dot.chartPoint = entry;
    const title = `${entry.label}: ${countFormat.format(entry.orders)} order${entry.orders === 1 ? '' : 's'}, ${peso.format(entry.sales)}`;
    if (dot.getAttribute('aria-label') !== title) dot.setAttribute('aria-label', title);
    let nodeTitle = dot.querySelector('title');
    if (!nodeTitle) { nodeTitle = document.createElementNS(svgNamespace, 'title'); dot.append(nodeTitle); }
    if (nodeTitle.textContent !== title) nodeTitle.textContent = title;
  });
  syncSvgMarkerSizes(svg);
  const previousPoints = dots.map((dot) => ({ x: Number(dot.dataset.x), y: Number(dot.dataset.y) }));
  const hasPreviousPoints = previousPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const geometryChanged = !hasPreviousPoints || previousPoints.some((point, index) => point.x !== points[index].x || point.y !== points[index].y);
  const paint = (coords) => {
    const pointText = (point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
    let path = `M${pointText(coords[0])}`;
    for (let index = 0; index < coords.length - 1; index++) {
      const previous = coords[Math.max(0, index - 1)];
      const current = coords[index];
      const next = coords[index + 1];
      const after = coords[Math.min(coords.length - 1, index + 2)];
      const controlOne = { x: current.x + (next.x - previous.x) / 6, y: current.y + (next.y - previous.y) / 6 };
      const controlTwo = { x: next.x - (after.x - current.x) / 6, y: next.y - (after.y - current.y) / 6 };
      path += ` C${pointText(controlOne)} ${pointText(controlTwo)} ${pointText(next)}`;
    }
    svg.querySelector('.chart-area').setAttribute('d', `${path} L${coords.at(-1).x.toFixed(2)},200 L${coords[0].x.toFixed(2)},200 Z`);
    svg.querySelector('.chart-line').setAttribute('d', path);
    dots.forEach((dot, i) => {
      dot.setAttribute('cx', String(coords[i].x)); dot.setAttribute('cy', String(coords[i].y));
      dot.dataset.x = String(coords[i].x); dot.dataset.y = String(coords[i].y);
    });
  };
  if (geometryChanged) {
    if (chartAnimationFrame) cancelAnimationFrame(chartAnimationFrame);
    chartAnimationFrame = 0;
    if (!hasPreviousPoints || reducedMotion) {
      paint(points);
    } else {
      const started = performance.now();
      const move = (time) => {
        const progress = Math.min(1, (time - started) / 650);
        const eased = 1 - (1 - progress) ** 3;
        paint(points.map((point, i) => ({
          x: previousPoints[i].x + (point.x - previousPoints[i].x) * eased,
          y: previousPoints[i].y + (point.y - previousPoints[i].y) * eased
        })));
        if (progress < 1) chartAnimationFrame = requestAnimationFrame(move);
        else chartAnimationFrame = 0;
      };
      chartAnimationFrame = requestAnimationFrame(move);
    }
  }
  if (svg.dataset.introPlayed !== 'true') {
    svg.dataset.introPlayed = 'true';
    if (!reducedMotion) {
      const line = svg.querySelector('.chart-line');
      const lineLength = line.getTotalLength();
      line.style.strokeDasharray = `${lineLength} ${lineLength}`;
      line.style.strokeDashoffset = String(lineLength);
      const lineIntro = line.animate(
        [{ strokeDashoffset: lineLength }, { strokeDashoffset: 0 }],
        { duration: 1050, easing: 'cubic-bezier(.2,.75,.25,1)' }
      );
      lineIntro.onfinish = () => {
        line.style.removeProperty('stroke-dasharray');
        line.style.removeProperty('stroke-dashoffset');
      };
      const area = svg.querySelector('.chart-area');
      const areaIntro = area.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 850, easing: 'ease-out' });
      areaIntro.onfinish = () => areaIntro.cancel();
      dots.forEach((dot, index) => {
        const pointIntro = dot.animate(
          [{ opacity: 0, transform: 'scale(.15)' }, { opacity: 1, transform: 'scale(1)' }],
          { duration: 280, delay: Math.min(index * 28, 420), easing: 'ease-out' }
        );
        pointIntro.onfinish = () => pointIntro.cancel();
      });
    }
  }

  const axisLabels = mode === 'hours'
    ? [0, 4, 8, 12, 16, 20, 23].map((hour) => { const date = new Date(`${(data.selectedDate || byId('chartDate').value)}T12:00:00`); date.setHours(hour, 0, 0, 0); return { position: points[hour].x, label: date.toLocaleTimeString('en-PH', { hour: 'numeric' }) }; })
    : entries.map((entry, index) => ({ position: points[index].x, label: entry.axis }));
  const chartDays = byId('chartDays');
  chartDays.dataset.mode = mode;
  const axisSignature = JSON.stringify(axisLabels);
  if (chartDays.dataset.labels !== axisSignature) {
    chartDays.replaceChildren(...axisLabels.map(({ position, label }) => {
      const span = document.createElement('span'); span.textContent = label;
      span.style.left = `${position / chartWidth * 100}%`;
      return span;
    }));
    chartDays.dataset.labels = axisSignature;
  }
  if (mode === 'hours' && !chartScroll.dataset.initialized) {
    const today = byId('chartDate').max;
    const currentHour = (data.selectedDate || today) === today ? new Date().getHours() : 0;
    chartScroll.scrollLeft = Math.max(0, points[Math.min(currentHour, points.length - 1)].x - chartScroll.clientWidth * 0.7);
    chartScroll.dataset.initialized = 'true';
  }
  const selectedDate = data.selectedDate || byId('chartDate').value;
  const selectedDay = new Date(`${selectedDate}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const isToday = selectedDate === byId('chartDate').max;
  byId('chartKicker').textContent = mode === 'hours' ? (isToday ? 'TODAY BY HOUR' : `BY HOUR · ${selectedDay.toUpperCase()}`) : `7 DAYS THROUGH ${selectedDay.toUpperCase()}`;
  byId('chartRange').textContent = mode === 'hours' ? (isToday ? 'order value today' : `order value on ${selectedDay}`) : `order value in the 7 days through ${selectedDay}`;
  svg.setAttribute('aria-label', mode === 'hours' ? `Hourly order value for ${selectedDay}` : `Daily order value for the 7 days through ${selectedDay}`);
  animateValue(byId('chartTotal'), values.reduce((sum, amount) => sum + amount, 0), (value) => peso.format(value));
  const spark = byId('salesSpark');
  let sparkLine = spark.querySelector('svg path');
  if (!sparkLine) { spark.innerHTML = '<svg viewBox="0 0 100 32" aria-hidden="true"><path fill="none" stroke="#83956f" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'; sparkLine = spark.querySelector('svg path'); }
  const weekValues = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${selectedDate}T12:00:00`); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return Number(dates.get(key)?.sales || 0);
  });
  const sparkMax = Math.max(...weekValues, 100);
  sparkLine.setAttribute('d', weekValues.map((value, i) => `${i ? 'L' : 'M'}${i * 16},${30 - value / sparkMax * 24}`).join(' '));
}

function showDonutPopover(content, item, kind, share, event) {
  let card = content.querySelector('.donut-popover');
  if (!card) {
    card = document.createElement('div');
    card.className = 'donut-popover';
    card.setAttribute('role', 'status');
    card.innerHTML = '<img class="donut-popover-image" alt=""><div class="donut-popover-copy"><small></small><strong></strong><span class="donut-popover-share"></span><span class="donut-popover-detail"></span></div>';
    content.append(card);
  }
  const isOther = String(item.id) === '__other';
  const image = card.querySelector('img');
  image.src = isOther ? 'assets/cookies/Cookie1.png' : imageForProduct(item.id);
  image.alt = isOther ? 'Assorted products' : `${item.name} product`;
  card.querySelector('small').textContent = `${kind === 'sales' ? 'PRODUCT SALES' : 'PRODUCT CLICKS'} · ${formatCalendarDate(byId('chartDate').value, { month: 'short', day: 'numeric' }).toUpperCase()}`;
  card.querySelector('strong').textContent = item.name;
  card.querySelector('.donut-popover-share').textContent = `${Math.round(share * 100)}% of ${kind === 'sales' ? 'order value' : 'product clicks'}`;
  card.querySelector('.donut-popover-detail').textContent = isOther
    ? `${countFormat.format(item.count || 0)} products combined · ${kind === 'sales' ? peso.format(item.value) : `${countFormat.format(item.value)} clicks`}`
    : kind === 'sales'
      ? `${peso.format(item.value)} order value · ${countFormat.format(item.units || 0)} items requested`
      : `${countFormat.format(item.value)} product detail views`;
  card.dataset.key = String(item.id ?? item.name);
  const bounds = content.getBoundingClientRect();
  const cardWidth = Math.min(226, bounds.width - 16);
  const x = event?.clientX ? event.clientX - bounds.left + 12 : bounds.width / 2;
  const y = event?.clientY ? event.clientY - bounds.top + 12 : 12;
  card.style.left = `${Math.max(8, Math.min(bounds.width - cardWidth - 8, x))}px`;
  card.style.top = `${Math.max(8, Math.min(bounds.height - 94, y))}px`;
  card.hidden = false;
}

function hideDonutPopover(content) {
  const card = content.querySelector('.donut-popover');
  if (card) card.hidden = true;
  content.querySelectorAll('.donut-segment[aria-pressed="true"]').forEach((segment) => {
    segment.setAttribute('aria-pressed', 'false');
  });
}

function openDonutPopover(content, segment, kind, event) {
  content.querySelectorAll('.donut-segment').forEach((item) => item.setAttribute('aria-pressed', String(item === segment)));
  showDonutPopover(content, segment.donutItem, kind, segment.donutShare, event);
}

function setupDonutPopovers() {
  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Element && event.target.closest('.donut-segment')) return;
    document.querySelectorAll('.donut-content').forEach(hideDonutPopover);
  });
}

function drawDonut(svgId, legendId, totalId, rows, formatter, centerFormatter, kind) {
  const svg = byId(svgId);
  const legend = byId(legendId);
  const content = legend.closest('.donut-content');
  const total = (rows || []).reduce((sum, item) => sum + Number(item.value || 0), 0);
  animateValue(byId(totalId), total, centerFormatter);
  const sorted = [...(rows || [])].map((item) => ({ ...item, value: Number(item.value || 0) })).filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const visible = sorted.slice(0, 5);
  const other = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
  if (other > 0) visible.push({ id: '__other', name: 'Other products', value: other, count: sorted.length - 5 });
  let track = svg.querySelector('.donut-track');
  if (!track) {
    track = document.createElementNS(svgNamespace, 'circle'); track.setAttribute('class', 'donut-track');
    track.setAttribute('cx', '80'); track.setAttribute('cy', '80'); track.setAttribute('r', '52'); svg.append(track);
  }
  const circumference = 2 * Math.PI * 52;
  const playIntro = svg.dataset.introPlayed !== 'true' && !reducedMotion;
  const segments = new Map([...svg.querySelectorAll('.donut-segment')].map((segment) => [segment.dataset.key, segment]));
  let offset = 0;
  visible.forEach((item, index) => {
    const key = String(item.id ?? item.name);
    let segment = segments.get(key);
    if (!segment) {
      segment = document.createElementNS(svgNamespace, 'circle'); segment.classList.add('donut-segment');
      segment.setAttribute('cx', '80'); segment.setAttribute('cy', '80'); segment.setAttribute('r', '52');
      segment.setAttribute('transform', 'rotate(-90 80 80)'); segment.dataset.key = key;
      segment.setAttribute('tabindex', '0'); segment.setAttribute('role', 'button');
      segment.setAttribute('aria-pressed', 'false');
      segment.addEventListener('pointerenter', (event) => {
        showDonutPopover(content, segment.donutItem, kind, segment.donutShare, event);
      });
      segment.addEventListener('pointermove', (event) => {
        if (segment.getAttribute('aria-pressed') !== 'true') {
          showDonutPopover(content, segment.donutItem, kind, segment.donutShare, event);
        }
      });
      segment.addEventListener('pointerleave', () => {
        if (segment.getAttribute('aria-pressed') !== 'true' && document.activeElement !== segment) {
          hideDonutPopover(content);
        }
      });
      segment.addEventListener('click', (event) => {
        event.stopPropagation();
        openDonutPopover(content, segment, kind, event);
      });
      segment.addEventListener('focus', () => {
        const bounds = segment.getBoundingClientRect();
        openDonutPopover(content, segment, kind, { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 });
      });
      segment.addEventListener('blur', () => hideDonutPopover(content));
      segment.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') { hideDonutPopover(content); segment.blur(); }
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const bounds = segment.getBoundingClientRect();
          openDonutPopover(content, segment, kind, { clientX: bounds.left + bounds.width / 2, clientY: bounds.top + bounds.height / 2 });
        }
      });
      svg.append(segment);
    }
    segments.delete(key);
    const share = total ? item.value / total : 0;
    segment.donutItem = item;
    segment.donutShare = share;
    segment.style.stroke = donutColors[index % donutColors.length];
    const dashArray = `${circumference * share} ${circumference}`;
    if (segment.style.strokeDasharray !== dashArray) segment.style.strokeDasharray = dashArray;
    const dashOffset = String(-offset);
    if (segment.style.strokeDashoffset !== dashOffset) segment.style.strokeDashoffset = dashOffset;
    if (playIntro) {
      segment.animate(
        [{ strokeDasharray: `0 ${circumference}` }, { strokeDasharray: dashArray }],
        { duration: 820, delay: index * 85, easing: 'cubic-bezier(.2,.75,.25,1)' }
      );
    }
    segment.setAttribute('aria-label', `${item.name}: ${Math.round(share * 100)}%, ${formatter(item.value)}`);
    let title = segment.querySelector('title'); if (!title) { title = document.createElementNS(svgNamespace, 'title'); segment.append(title); }
    title.textContent = `${item.name}: ${Math.round(share * 100)}% · ${formatter(item.value)}`;
    offset += circumference * share;
  });
  segments.forEach((segment) => segment.remove());
  const oldRows = new Map([...legend.querySelectorAll('.donut-legend-row')].map((row) => [row.dataset.key, row]));
  if (!visible.length) {
    let empty = legend.querySelector('.donut-empty');
    if (!empty) { empty = document.createElement('p'); empty.className = 'donut-empty'; legend.replaceChildren(empty); }
    const dateLabel = formatCalendarDate(byId('chartDate').value);
    empty.textContent = svgId === 'salesMixChart' ? `No sales mix recorded for ${dateLabel}.` : `No product clicks recorded for ${dateLabel}.`;
    const card = content.querySelector('.donut-popover'); if (card) card.hidden = true;
    return;
  }
  legend.querySelector('.donut-empty')?.remove();
  svg.dataset.introPlayed = 'true';
  visible.forEach((item, index) => {
    const key = String(item.id ?? item.name);
    let row = oldRows.get(key);
    if (!row) {
      row = document.createElement('div'); row.className = 'donut-legend-row'; row.dataset.key = key;
      row.innerHTML = '<span class="donut-legend-art"><img alt=""><i></i></span><div class="donut-legend-copy"><strong></strong><span></span></div><b></b>';
      if (!reducedMotion) row.animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    oldRows.delete(key);
    const icon = row.querySelector('.donut-legend-art img');
    const imagePath = String(item.id) === '__other' ? 'assets/cookies/Cookie1.png' : imageForProduct(item.id);
    if (icon.getAttribute('src') !== imagePath) icon.src = imagePath;
    icon.alt = String(item.id) === '__other' ? 'Assorted products' : `${item.name} product`;
    row.querySelector('.donut-legend-art i').style.background = donutColors[index % donutColors.length];
    if (row.querySelector('strong').textContent !== item.name) row.querySelector('strong').textContent = item.name;
    const amount = row.querySelector('.donut-legend-copy span');
    const nextAmount = formatter(item.value);
    if (amount.textContent !== nextAmount) {
      amount.textContent = nextAmount;
      if (!reducedMotion && row.isConnected) amount.animate([{ opacity: .35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    const percentage = `${total ? Math.round(item.value / total * 100) : 0}%`;
    const percentNode = row.querySelector('b');
    if (percentNode.textContent !== percentage) {
      percentNode.textContent = percentage;
      if (!reducedMotion && row.isConnected) percentNode.animate([{ opacity: .35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
    const current = legend.children[index];
    if (current !== row) legend.insertBefore(row, current || null);
  });
  oldRows.forEach((row) => row.remove());
}

function slideText(element, value) {
  if (element.textContent === value) return;
  element.textContent = value;
  if (!reducedMotion) element.animate([{ opacity: .35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], {
    duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)'
  });
}

function updateFavorite(data, nameId, metaId, imageId, fallback, meta) {
  slideText(byId(nameId), data?.name || fallback);
  slideText(byId(metaId), data ? meta(data) : (nameId === 'topSoldName' ? 'Your best seller will show up here' : 'Your most viewed product will show up here'));
  const image = byId(imageId);
  const nextImage = data ? imageForProduct(data.id) : 'assets/cookies/Cookie1.png';
  if (image.getAttribute('src') !== nextImage) {
    image.src = nextImage;
    if (!reducedMotion) image.animate([{ opacity: .35, transform: 'translateY(5px) scale(.96)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], {
      duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)'
    });
  }
  const nextAlt = data ? `${data.name} product` : 'Cookie product preview';
  if (image.alt !== nextAlt) image.alt = nextAlt;
}

function renderActivity(rows, selectedDateLabel) {
  const list = byId('activityList');
  if (!rows?.length) {
    if (!list.querySelector('.empty-state')) {
      list.replaceChildren();
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.innerHTML = '<svg><use href="assets/dashboard-icons.svg#spark"/></svg><p></p>';
      list.append(empty);
    }
    list.querySelector('.empty-state p').textContent = `No order activity for ${selectedDateLabel}.`;
    return;
  }
  list.querySelector('.empty-state')?.remove();
  const existing = new Map([...list.querySelectorAll(':scope > .activity-row')].map((element) => [element.dataset.orderId, element]));
  const oldPositions = new Map([...existing].map(([key, element]) => [key, element.getBoundingClientRect()]));
  const retained = new Set();
  const added = new Set();
  const ordered = [];

  rows.forEach((row, index) => {
    const key = String(row.order_id || `recent-${index}`);
    let element = existing.get(key);
    if (!element) {
      element = createActivityRow(key);
      added.add(element);
    }
    updateActivityRow(element, row);
    retained.add(key);
    ordered.push(element);
    const currentAtIndex = list.children[index];
    if (currentAtIndex !== element) list.insertBefore(element, currentAtIndex || null);
  });

  for (const [key, element] of existing) {
    if (!retained.has(key)) element.remove();
  }

  if (!reducedMotion) {
    ordered.forEach((element) => {
      if (added.has(element)) {
        element.animate([{ opacity: 0, transform: 'translateY(-10px)' }, { opacity: 1, transform: 'translateY(0)' }], {
          duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)'
        });
        return;
      }
      const before = oldPositions.get(element.dataset.orderId);
      const after = element.getBoundingClientRect();
      const distance = before ? before.top - after.top : 0;
      if (Math.abs(distance) > 1) {
        element.animate([{ transform: `translateY(${distance}px)` }, { transform: 'translateY(0)' }], {
          duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)'
        });
      }
    });
  }
}

function createActivityRow(orderId) {
  const element = document.createElement('div');
  element.className = 'activity-row';
  element.dataset.orderId = orderId;
  element.innerHTML = '<span class="activity-platform"><svg aria-hidden="true"></svg></span><div class="activity-copy"><strong></strong><div class="activity-products"></div></div><div class="activity-amount"><span class="activity-total"></span><span class="activity-time"></span></div>';
  return element;
}

function updateActivityRow(element, row) {
  const social = row.platform === 'facebook' ? 'facebook' : 'instagram';
  const channel = social === 'facebook' ? 'Facebook' : 'Instagram';
  const items = Array.isArray(row.items) ? row.items : [];
  const platformIcon = element.querySelector('.activity-platform');
  platformIcon.className = `activity-platform ${social}`;
  if (platformIcon.dataset.platform !== social) {
    platformIcon.querySelector('svg').innerHTML = `<use href="assets/dashboard-icons.svg#${social}"/>`;
    platformIcon.dataset.platform = social;
  }
  element.querySelector('.activity-copy strong').textContent = `${channel} order · ${countFormat.format(items.length)} product${items.length === 1 ? '' : 's'}`;

  const productList = element.querySelector('.activity-products');
  const productsVersion = JSON.stringify(items);
  if (productList.dataset.version !== productsVersion) {
    const nextProducts = document.createDocumentFragment();
    items.forEach((item) => {
      const line = document.createElement('span');
      line.className = 'activity-product-line';
      const image = document.createElement('img');
      image.src = imageForProduct(item.id);
      image.alt = '';
      const name = document.createElement('span');
      name.textContent = item.name;
      const quantity = document.createElement('b');
      quantity.textContent = `× ${countFormat.format(Number(item.quantity))}`;
      line.append(image, name, quantity);
      nextProducts.append(line);
    });
    productList.replaceChildren(nextProducts);
    productList.dataset.version = productsVersion;
  }

  element.querySelector('.activity-total').textContent = peso.format(Number(row.amount));
  const time = new Date(String(row.time).replace(' ', 'T') + (String(row.time).includes('+') ? '' : '+08:00'));
  element.querySelector('.activity-time').textContent = Number.isNaN(time.getTime())
    ? '' : time.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function setupSectionNavigation() {
  const links = [...document.querySelectorAll('.side-nav .nav-item')];
  const sectionLinks = links.filter((link) => !link.dataset.dashboardPage);
  const pageViews = { products: byId('storeProductsPage'), customers: byId('customerAccountPage') };
  const pageNames = { products: 'Products', customers: 'Accounts' };
  const overviewContent = [...byId('overview').children].filter((element) => (
    !element.classList.contains('topbar') && !element.matches('.store-products-page, .customer-account-page') && element.id !== 'errorBanner'
  ));
  let pendingNavigationLink = null;
  let navigationIdleTimer = 0;
  let navigationFallbackTimer = 0;
  const probes = sectionLinks.map((link) => {
    const href = link.getAttribute('href');
    return document.querySelector(href === '#overview' ? '.page-heading' : href);
  });
  const setActive = (activeLink) => links.forEach((item) => {
    const active = item === activeLink;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  const finishNavigation = () => {
    if (!pendingNavigationLink) return;
    pendingNavigationLink = null;
    window.clearTimeout(navigationIdleTimer);
    window.clearTimeout(navigationFallbackTimer);
    updateActiveFromScroll();
  };
  const openDashboardPage = (link) => {
    const pageKey = link.dataset.dashboardPage;
    Object.values(pageViews).forEach((page) => { page.hidden = page !== pageViews[pageKey]; });
    overviewContent.forEach((element) => { element.hidden = true; });
    byId('breadcrumbCurrent').textContent = pageNames[pageKey];
    history.replaceState(null, '', link.getAttribute('href'));
    setActive(link);
    pendingNavigationLink = null;
    window.clearTimeout(navigationIdleTimer);
    window.clearTimeout(navigationFallbackTimer);
    window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    if (pageKey === 'products') {
      byId('productDate').value = byId('chartDate').value;
      renderProductCards();
    } else if (pageKey === 'customers') {
      loadCustomerPage(customerPage, customerQuery);
    }
  };
  const showOverview = () => {
    Object.values(pageViews).forEach((page) => { page.hidden = true; });
    overviewContent.forEach((element) => { element.hidden = false; });
    byId('breadcrumbCurrent').textContent = 'Overview';
  };
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      if (link.dataset.dashboardPage) {
        event.preventDefault();
        openDashboardPage(link);
        return;
      }

      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      showOverview();
      pendingNavigationLink = link;
      window.clearTimeout(navigationIdleTimer);
      window.clearTimeout(navigationFallbackTimer);
      setActive(link);
      history.replaceState(null, '', link.getAttribute('href'));
      const targetAlreadyAligned = Math.abs(target.getBoundingClientRect().top) < 1;
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      target.classList.remove('section-focus');
      requestAnimationFrame(() => target.classList.add('section-focus'));
      window.setTimeout(() => target.classList.remove('section-focus'), 1200);
      if (reducedMotion || targetAlreadyAligned) {
        finishNavigation();
      } else {
        navigationFallbackTimer = window.setTimeout(finishNavigation, 1800);
      }
    });
  });
  let scrollFrame = 0;
  const updateActiveFromScroll = () => {
    scrollFrame = 0;
    if (pendingNavigationLink || Object.values(pageViews).some((page) => !page.hidden)) return;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll > 0 && window.scrollY >= maxScroll - 2) {
      setActive(sectionLinks[sectionLinks.length - 1]);
      return;
    }
    const threshold = Math.min(220, window.innerHeight * .28);
    let activeIndex = 0;
    probes.forEach((probe, index) => { if (probe && probe.getBoundingClientRect().top <= threshold) activeIndex = index; });
    setActive(sectionLinks[activeIndex]);
  };
  window.addEventListener('scroll', () => {
    if (pendingNavigationLink) {
      window.clearTimeout(navigationIdleTimer);
      navigationIdleTimer = window.setTimeout(finishNavigation, 180);
    }
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateActiveFromScroll);
  }, { passive: true });
  window.addEventListener('scrollend', finishNavigation, { passive: true });
  const initialPage = links.find((link) => link.dataset.dashboardPage && link.getAttribute('href') === window.location.hash);
  if (initialPage) openDashboardPage(initialPage);
  else updateActiveFromScroll();
}

function setupMobileBackStore() {
  const button = byId('mobileBackStore');
  const themeButtons = [...document.querySelectorAll('[data-theme-toggle]')];
  const stickyButtons = [button, ...themeButtons];
  const mobileViewport = window.matchMedia('(max-width: 760px)');
  let wasStuck = false;
  let exitTimer = 0;
  const update = () => {
    const isStuck = mobileViewport.matches && window.scrollY > 80;
    if (isStuck === wasStuck) return;
    wasStuck = isStuck;
    window.clearTimeout(exitTimer);

    if (isStuck) {
      stickyButtons.forEach((item) => {
        item.classList.add('is-stuck');
        item.classList.remove('is-leaving');
      });
      return;
    }

    stickyButtons.forEach((item) => item.classList.add('is-leaving'));
    exitTimer = window.setTimeout(() => {
      if (wasStuck) return;
      stickyButtons.forEach((item) => {
        item.classList.remove('is-stuck', 'is-leaving');
        if (!reducedMotion && item.animate) {
          item.animate([
            { opacity: 0 },
            { opacity: 1 }
          ], {
            duration: 280,
            easing: 'ease-out'
          });
        }
      });
    }, reducedMotion ? 0 : 360);
  };
  window.addEventListener('scroll', update, { passive: true });
  mobileViewport.addEventListener('change', update);
  update();
}

function setupChartInteraction() {
  const scroller = byId('chartScroll');
  let pointerId = null;
  let startX = 0;
  let startScroll = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let dragged = false;
  let glideFrame = 0;
  scroller.tabIndex = 0;
  scroller.setAttribute('aria-label', 'Order value chart. Drag or scroll horizontally to explore the full day.');
  scroller.addEventListener('wheel', (event) => {
    if (scroller.dataset.mode !== 'hours') return;
    const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (!delta) return;
    event.preventDefault();
    scroller.scrollLeft += delta;
  }, { passive: false });
  scroller.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || scroller.dataset.mode !== 'hours') return;
    pointerId = event.pointerId;
    scroller.setPointerCapture(event.pointerId);
    startX = lastX = event.clientX;
    startScroll = scroller.scrollLeft;
    lastTime = performance.now();
    velocity = 0;
    dragged = false;
    cancelAnimationFrame(glideFrame);
  });
  scroller.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return;
    const distance = startX - event.clientX;
    if (Math.abs(distance) > 3) {
      dragged = true;
      scroller.classList.add('is-dragging');
      byId('chartTooltip').hidden = true;
    }
    if (!dragged) return;
    event.preventDefault();
    scroller.scrollLeft = startScroll + distance;
    const now = performance.now();
    const elapsed = Math.max(1, now - lastTime);
    velocity = (lastX - event.clientX) / elapsed;
    lastX = event.clientX;
    lastTime = now;
  });
  const finishDrag = (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    scroller.classList.remove('is-dragging');
    if (dragged && !reducedMotion) {
      const glide = () => {
        velocity *= 0.94;
        if (Math.abs(velocity) < 0.025) return;
        scroller.scrollLeft += velocity * 16;
        glideFrame = requestAnimationFrame(glide);
      };
      glideFrame = requestAnimationFrame(glide);
    }
    dragged = false;
  };
  scroller.addEventListener('pointerup', finishDrag);
  scroller.addEventListener('pointercancel', finishDrag);
}

async function refreshDashboard(manual = false) {
  const requestId = ++dashboardRequestId;
  const button = byId('refreshButton');
  if (manual) button.classList.add('is-loading');
  try {
    const selectedDate = byId('chartDate').value;
    const response = await fetch(`api/dashboard-data.php?date=${encodeURIComponent(selectedDate)}`, { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json();
    if (requestId !== dashboardRequestId) return;
    if (response.status === 401) {
      byId('accessState').hidden = false;
      throw new Error('admin_required');
    }
    if (!response.ok || !result.ok) throw new Error(result.message || 'Dashboard data could not be loaded.');
    byId('accessState').hidden = true;
    byId('errorBanner').hidden = true;
    const dashboardDate = result.selectedDate || byId('chartDate').value;
    const selectedIsToday = dashboardDate === byId('chartDate').max;
    const selectedDateLabel = formatCalendarDate(dashboardDate);
    byId('productDate').value = dashboardDate;
    byId('productsDateDescription').textContent = selectedIsToday
      ? 'Product performance for today.'
      : `Product performance for ${selectedDateLabel}.`;
    byId('todayLabel').textContent = selectedDateLabel;
    const comparisonLabel = selectedIsToday ? 'vs. yesterday' : 'vs. previous day';
    byId('dayLabel').textContent = new Date(`${dashboardDate}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase();
    byId('dashboardDateDescription').textContent = selectedIsToday ? 'A little look at how Selah is doing today.' : `A look at Selah on ${selectedDateLabel}.`;
    byId('metricsGrid').setAttribute('aria-label', `Summary for ${selectedDateLabel}`);
    byId('salesMetricLabel').textContent = selectedIsToday ? 'Order value today' : `Order value · ${selectedDateLabel}`;
    byId('salesCompareLabel').textContent = comparisonLabel;
    byId('ordersCompareLabel').textContent = comparisonLabel;
    byId('clicksDateLabel').textContent = selectedIsToday ? 'Today' : selectedDateLabel;
    byId('itemsDateLabel').textContent = selectedIsToday ? 'Today' : selectedDateLabel;
    animateValue(byId('salesValue'), result.selected.sales, (value) => peso.format(value));
    animateValue(byId('ordersValue'), result.selected.orders, (value) => countFormat.format(Math.round(value)));
    animateValue(byId('clicksValue'), result.selected.clicks, (value) => countFormat.format(Math.round(value)));
    animateValue(byId('itemsValue'), result.selected.items, (value) => countFormat.format(Math.round(value)));
    changeLabel(byId('salesChange'), result.selected.salesChange, true);
    changeLabel(byId('ordersChange'), result.selected.ordersChange);
    dashboardData = result;
    renderProductCards();
    drawChart(result, activeChartMode);
    const selectedKicker = selectedIsToday ? 'TODAY' : selectedDateLabel.toUpperCase();
    byId('salesMixKicker').textContent = `PRODUCT MIX · ${selectedKicker}`;
    byId('clickMixKicker').textContent = `PRODUCT INTEREST · ${selectedKicker}`;
    byId('favoritesKicker').textContent = `CUSTOMER FAVORITES · ${selectedKicker}`;
    byId('topSoldKicker').textContent = `MOST REQUESTED · ${selectedKicker}`;
    byId('topClickedKicker').textContent = `MOST CLICKED · ${selectedKicker}`;
    byId('channelsKicker').textContent = selectedIsToday ? "TODAY'S CHANNELS" : `CHANNELS · ${selectedDateLabel.toUpperCase()}`;
    byId('activityKicker').textContent = selectedIsToday ? 'TODAY' : selectedDateLabel.toUpperCase();
    byId('activityLiveLabel').textContent = selectedIsToday ? 'Updating' : 'Selected date';
    drawDonut('salesMixChart', 'salesMixLegend', 'salesMixTotal', result.salesMix, (value) => peso.format(value), (value) => peso.format(value), 'sales');
    drawDonut('clickMixChart', 'clickMixLegend', 'clickMixTotal', result.clickMix, (value) => `${countFormat.format(value)} clicks`, (value) => countFormat.format(value), 'clicks');
    updateFavorite(result.topSold, 'topSoldName', 'topSoldMeta', 'topSoldImage', 'No requests on this date', (item) => `${countFormat.format(Number(item.units))} items requested`);
    updateFavorite(result.topClicked, 'topClickedName', 'topClickedMeta', 'topClickedImage', 'No clicks on this date', (item) => `${countFormat.format(Number(item.clicks))} product detail views`);
    if (!result.topSold) byId('topSoldMeta').textContent = `No order requests on ${selectedDateLabel}.`;
    if (!result.topClicked) byId('topClickedMeta').textContent = `No product views on ${selectedDateLabel}.`;
    const orders = Object.fromEntries((result.platforms || []).map((item) => [item.platform, Number(item.orders)]));
    const facebook = orders.facebook || 0;
    const instagram = orders.instagram || 0;
    const total = facebook + instagram;
    byId('facebookCount').textContent = countFormat.format(facebook);
    byId('instagramCount').textContent = countFormat.format(instagram);
    byId('facebookBar').style.width = `${total ? facebook / total * 100 : 0}%`;
    byId('instagramBar').style.width = `${total ? instagram / total * 100 : 0}%`;
    byId('activityList').setAttribute('aria-label', `Order activity for ${selectedDateLabel}`);
    renderActivity(result.recent, selectedDateLabel);
    const favoriteText = result.topClicked && result.topSold && result.topClicked.id === result.topSold.id
      ? `${result.topClicked.name} led in both product views and requests on ${selectedDateLabel}.`
      : result.topClicked ? `${result.topClicked.name} drew the most product interest on ${selectedDateLabel}.` : `Product insights for ${selectedDateLabel} will appear here when shoppers browse.`;
    byId('insightText').textContent = favoriteText;
    byId('syncLabel').textContent = `Updated ${new Date(result.updatedAt).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })}`;
  } catch (error) {
    if (error.message !== 'admin_required') {
      byId('errorBanner').textContent = error.message || 'Could not reach the dashboard data service.';
      byId('errorBanner').hidden = false;
      byId('syncLabel').textContent = 'Connection issue';
    }
  } finally {
    if (requestId === dashboardRequestId) button.classList.remove('is-loading');
  }
}

setLocalDate();
setupThemeToggle();
setupProductPage();
setupSectionNavigation();
setupCustomerPage();
setupMobileBackStore();
setupDonutPopovers();
setupChartInteraction();
setupSvgMarkerSizing();
setupCalendar();
byId('refreshButton').addEventListener('click', () => refreshDashboard(true));
document.querySelectorAll('[data-chart-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    activeChartMode = button.dataset.chartMode;
    document.querySelectorAll('[data-chart-mode]').forEach((item) => item.classList.toggle('is-active', item === button));
    if (dashboardData) drawChart(dashboardData, activeChartMode);
  });
});
byId('chartDate').addEventListener('change', () => {
  if (!byId('chartDate').value) return;
  byId('productDate').value = byId('chartDate').value;
  activeChartMode = 'hours';
  document.querySelectorAll('[data-chart-mode]').forEach((item) => item.classList.toggle('is-active', item.dataset.chartMode === 'hours'));
  byId('chartScroll').dataset.initialized = '';
  refreshDashboard();
});
byId('dashboardLoginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const submit = byId('dashboardLoginSubmit');
  const error = byId('dashboardLoginError');
  error.hidden = true;
  submit.disabled = true;
  submit.textContent = 'Signing in…';
  try {
    const response = await fetch('api/dashboard-login.php', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: byId('dashboardUsername').value,
        password: byId('dashboardPassword').value
      })
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message || 'Could not sign in to the dashboard.');
    byId('accessState').hidden = true;
    byId('dashboardPassword').value = '';
    form.reset();
    await refreshDashboard();
  } catch (loginError) {
    error.textContent = loginError.message || 'Could not sign in to the dashboard.';
    error.hidden = false;
  } finally {
    submit.disabled = false;
    submit.textContent = 'Sign in to dashboard';
  }
});
void loadStoreProducts();
refreshDashboard();
window.setInterval(() => {
  refreshDashboard();
  if (!byId('customerAccountPage').hidden) loadCustomerPage(customerPage, customerQuery);
}, 15000);
