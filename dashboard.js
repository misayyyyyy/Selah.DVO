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
const svgNamespace = 'http://www.w3.org/2000/svg';
let dashboardData = null;
let activeChartMode = 'hours';
let chartAnimationFrame = 0;
let dashboardRequestId = 0;
let calendarViewMonth = null;
const donutColors = ['#7f936a', '#d3a27d', '#8d819f', '#d6bf72', '#7a9d9a', '#bd8290', '#aaa78e'];

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatCalendarDate(value, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-PH', options);
}

function renderCalendar() {
  const input = byId('chartDate');
  const selected = new Date(`${input.value}T12:00:00`);
  const today = new Date(`${input.max}T12:00:00`);
  if (!calendarViewMonth) calendarViewMonth = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const monthKey = `${calendarViewMonth.getFullYear()}-${calendarViewMonth.getMonth()}`;
  byId('calendarMonth').textContent = calendarViewMonth.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
  byId('calendarSelectedLabel').textContent = `Selected · ${formatCalendarDate(input.value)}`;
  const next = byId('calendarNext');
  next.disabled = calendarViewMonth.getFullYear() === today.getFullYear() && calendarViewMonth.getMonth() >= today.getMonth();
  const monthStart = new Date(calendarViewMonth.getFullYear(), calendarViewMonth.getMonth(), 1);
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
    button.classList.toggle('is-outside', date.getMonth() !== calendarViewMonth.getMonth());
    button.classList.toggle('is-selected', key === input.value);
    button.classList.toggle('is-today', key === input.max);
    button.disabled = key > input.max;
    button.addEventListener('click', () => {
      input.value = key;
      byId('chartDateLabel').textContent = formatCalendarDate(key);
      calendarViewMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      renderCalendar();
      closeCalendar();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    return button;
  });
  byId('calendarDays').replaceChildren(...days);
  byId('calendarDays').dataset.month = monthKey;
}

function openCalendar() {
  calendarViewMonth = new Date(`${byId('chartDate').value}T12:00:00`);
  calendarViewMonth.setDate(1);
  renderCalendar();
  byId('chartCalendar').hidden = false;
  byId('chartDateButton').setAttribute('aria-expanded', 'true');
}

function closeCalendar() {
  byId('chartCalendar').hidden = true;
  byId('chartDateButton').setAttribute('aria-expanded', 'false');
}

function setupCalendar() {
  byId('chartDateButton').addEventListener('click', () => {
    if (byId('chartCalendar').hidden) openCalendar();
    else closeCalendar();
  });
  byId('calendarPrevious').addEventListener('click', () => {
    calendarViewMonth.setMonth(calendarViewMonth.getMonth() - 1);
    renderCalendar();
  });
  byId('calendarNext').addEventListener('click', () => {
    calendarViewMonth.setMonth(calendarViewMonth.getMonth() + 1);
    renderCalendar();
  });
  byId('calendarToday').addEventListener('click', () => {
    byId('chartDate').value = byId('chartDate').max;
    byId('chartDateLabel').textContent = formatCalendarDate(byId('chartDate').value);
    closeCalendar();
    byId('chartDate').dispatchEvent(new Event('change', { bubbles: true }));
  });
  document.addEventListener('pointerdown', (event) => {
    if (!byId('chartDatePicker').contains(event.target)) closeCalendar();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !byId('chartCalendar').hidden) {
      closeCalendar();
      byId('chartDateButton').focus();
    }
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
    svg.innerHTML = `<defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#9bad86" stop-opacity=".32"/><stop offset="100%" stop-color="#9bad86" stop-opacity="0"/></linearGradient></defs><line class="chart-grid-line" x1="28" y1="38" x2="690" y2="38"/><line class="chart-grid-line" x1="28" y1="88" x2="690" y2="88"/><line class="chart-grid-line" x1="28" y1="138" x2="690" y2="138"/><path class="chart-area"/><path class="chart-line"/><g class="chart-point-layer"></g>`;
  }
  svg.querySelectorAll('.chart-grid-line').forEach((line) => {
    const end = String(chartWidth - 28);
    if (line.getAttribute('x2') !== end) line.setAttribute('x2', end);
  });
  const layer = svg.querySelector('.chart-point-layer');
  let dots = [...layer.querySelectorAll('.chart-dot')];
  if (dots.length !== entries.length) {
    layer.replaceChildren(...entries.map(() => {
      const dot = document.createElementNS(svgNamespace, 'circle');
      dot.classList.add('chart-dot');
      dot.setAttribute('r', '3.7');
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
  const previousPoints = dots.map((dot) => ({ x: Number(dot.dataset.x), y: Number(dot.dataset.y) }));
  const hasPreviousPoints = previousPoints.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  const geometryChanged = !hasPreviousPoints || previousPoints.some((point, index) => point.x !== points[index].x || point.y !== points[index].y);
  const paint = (coords) => {
    const path = coords.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join(' ');
    svg.querySelector('.chart-area').setAttribute('d', `${path} L${coords.at(-1).x},200 L${coords[0].x},200 Z`);
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
  const bounds = content.getBoundingClientRect();
  const cardWidth = Math.min(226, bounds.width - 16);
  const x = event?.clientX ? event.clientX - bounds.left + 12 : bounds.width / 2;
  const y = event?.clientY ? event.clientY - bounds.top + 12 : 12;
  card.style.left = `${Math.max(8, Math.min(bounds.width - cardWidth - 8, x))}px`;
  card.style.top = `${Math.max(8, Math.min(bounds.height - 94, y))}px`;
  card.hidden = false;
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
      segment.addEventListener('pointerenter', (event) => showDonutPopover(content, segment.donutItem, kind, segment.donutShare, event));
      segment.addEventListener('pointermove', (event) => showDonutPopover(content, segment.donutItem, kind, segment.donutShare, event));
      segment.addEventListener('focus', () => showDonutPopover(content, segment.donutItem, kind, segment.donutShare));
      segment.addEventListener('pointerleave', () => { const card = content.querySelector('.donut-popover'); if (card) card.hidden = true; });
      segment.addEventListener('blur', () => { const card = content.querySelector('.donut-popover'); if (card) card.hidden = true; });
      segment.addEventListener('keydown', (event) => { if (event.key === 'Escape') { const card = content.querySelector('.donut-popover'); if (card) card.hidden = true; segment.blur(); } });
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
  const probes = links.map((link) => {
    const href = link.getAttribute('href');
    return document.querySelector(href === '#overview' ? '.page-heading' : href);
  });
  const setActive = (activeLink) => links.forEach((item) => {
    const active = item === activeLink;
    item.classList.toggle('active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  links.forEach((link) => {
    link.addEventListener('click', (event) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      event.preventDefault();
      setActive(link);
      history.replaceState(null, '', link.getAttribute('href'));
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      target.classList.remove('section-focus');
      requestAnimationFrame(() => target.classList.add('section-focus'));
      window.setTimeout(() => target.classList.remove('section-focus'), 1200);
    });
  });
  let scrollFrame = 0;
  const updateActiveFromScroll = () => {
    scrollFrame = 0;
    const threshold = window.innerHeight * .42;
    let activeIndex = 0;
    probes.forEach((probe, index) => { if (probe && probe.getBoundingClientRect().top <= threshold) activeIndex = index; });
    setActive(links[activeIndex]);
  };
  window.addEventListener('scroll', () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateActiveFromScroll);
  }, { passive: true });
  updateActiveFromScroll();
}

function setupMobileBackStore() {
  const button = byId('mobileBackStore');
  const mobileViewport = window.matchMedia('(max-width: 760px)');
  const update = () => button.classList.toggle('is-stuck', mobileViewport.matches && window.scrollY > 80);
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
setupSectionNavigation();
setupMobileBackStore();
setupChartInteraction();
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
refreshDashboard();
window.setInterval(() => refreshDashboard(), 15000);
