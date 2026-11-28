(() => {
  const countrySelect = document.getElementById('countrySelect');
  const cityInput = document.getElementById('cityInput');
  const suggestions = document.getElementById('citySuggestions');
  const status = document.getElementById('locationStatus');
  const form = document.getElementById('createAccountForm');
  if (!countrySelect || !cityInput || !suggestions || !status || !form) return;

  const citiesByCountry = new Map();
  const pendingCityLoads = new Set();
  const failedCityLoads = new Set();
  let countries = [];
  let activeCities = [];
  let countryWasChosen = false;
  let highlightedIndex = -1;
  let selectedCity = '';
  let selectedCityCountry = '';

  const searchKey = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();

  const setSuggestionsOpen = (open) => {
    suggestions.hidden = !open;
    cityInput.setAttribute('aria-expanded', String(open));
    if (!open) highlightedIndex = -1;
  };

  const syncLocationValidity = () => {
    const hasCity = cityInput.value.trim() !== '';
    countrySelect.setCustomValidity(hasCity && !countrySelect.value ? 'Choose a country for this city.' : '');
    cityInput.setCustomValidity(hasCity && countrySelect.value
      && (selectedCity !== cityInput.value.trim() || selectedCityCountry !== countrySelect.value)
      ? 'Select a city from the suggestions for this country.'
      : '');
  };

  const renderSuggestions = () => {
    const term = searchKey(cityInput.value.trim());
    const matches = activeCities
      .map((name) => ({ name, key: searchKey(name) }))
      .filter((item) => !term || item.key.includes(term))
      .sort((left, right) => {
        if (term) {
          const leftStarts = left.key.startsWith(term);
          const rightStarts = right.key.startsWith(term);
          if (leftStarts !== rightStarts) return leftStarts ? -1 : 1;
        }
        return left.name.localeCompare(right.name);
      })
      .slice(0, 12);

    suggestions.replaceChildren();
    highlightedIndex = -1;
    if (!activeCities.length) {
      setSuggestionsOpen(false);
      return;
    }

    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'city-suggestion-empty';
      empty.textContent = 'No matching city. Select a city from the list.';
      suggestions.append(empty);
    } else {
      const fragment = document.createDocumentFragment();
      matches.forEach((item) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'city-suggestion-option';
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', String(item.name === selectedCity && selectedCityCountry === countrySelect.value));
        option.textContent = item.name;
        option.addEventListener('mousedown', (event) => event.preventDefault());
        option.addEventListener('click', () => {
          cityInput.value = item.name;
          selectedCity = item.name;
          selectedCityCountry = countrySelect.value;
          cityInput.dispatchEvent(new Event('input', { bubbles: true }));
          setSuggestionsOpen(false);
          cityInput.focus();
        });
        fragment.append(option);
      });
      suggestions.append(fragment);
    }
    setSuggestionsOpen(true);
  };

  const loadCities = async (country, retry = false) => {
    if (!country) {
      activeCities = [];
      status.textContent = 'Choose a country before searching for a city.';
      setSuggestionsOpen(false);
      return;
    }

    const cached = citiesByCountry.get(country.Iso2);
    if (cached) {
      activeCities = cached;
      status.textContent = `Search ${cached.length.toLocaleString()} available places in ${country.name}.`;
      if (document.activeElement === cityInput) renderSuggestions();
      return;
    }

    if (pendingCityLoads.has(country.Iso2)) {
      status.textContent = `Loading city suggestions for ${country.name}…`;
      return;
    }
    if (failedCityLoads.has(country.Iso2) && !retry) return;

    activeCities = [];
    pendingCityLoads.add(country.Iso2);
    status.textContent = `Loading city suggestions for ${country.name}…`;
    setSuggestionsOpen(false);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(`api/location-cities.php?country=${encodeURIComponent(country.Iso2)}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !Array.isArray(result.cities)) throw new Error('City list unavailable.');
      const cityNames = [...new Set(result.cities
        .filter((name) => typeof name === 'string' && name.trim())
        .map((name) => name.trim()))]
        .sort((left, right) => left.localeCompare(right));
      citiesByCountry.set(country.Iso2, cityNames);
      failedCityLoads.delete(country.Iso2);
      if (countrySelect.value !== country.Iso2) return;
      activeCities = cityNames;
      status.textContent = cityNames.length
        ? `Search ${cityNames.length.toLocaleString()} available places in ${country.name}.`
        : `No city suggestions were found for ${country.name}. Choose another country.`;
      if (document.activeElement === cityInput) renderSuggestions();
    } catch {
      failedCityLoads.add(country.Iso2);
      if (countrySelect.value === country.Iso2) {
        activeCities = [];
        status.textContent = `City suggestions are unavailable for ${country.name}. Try again later to create an account.`;
      }
    } finally {
      pendingCityLoads.delete(country.Iso2);
      window.clearTimeout(timeout);
    }
  };

  const setCountry = (country) => {
    if (!country) return false;
    countrySelect.value = country.Iso2;
    countrySelect.dispatchEvent(new Event('input', { bubbles: true }));
    syncLocationValidity();
    return true;
  };

  const detectCountry = async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch('https://ipwho.is/?fields=success,country,country_code', {
        cache: 'no-store',
        signal: controller.signal
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error('Country detection unavailable.');
      if (countryWasChosen || countrySelect.value) return;
      const country = countries.find((item) => item.Iso2 === String(result.country_code || '').toUpperCase())
        || countries.find((item) => item.name.toLocaleLowerCase() === String(result.country || '').toLocaleLowerCase());
      if (!country || !setCountry(country)) throw new Error('Country not found.');
      status.textContent = `Country suggested from your connection: ${country.name}. You can change it anytime.`;
      if (document.activeElement === cityInput || cityInput.value.trim()) void loadCities(country);
    } catch {
      if (!countrySelect.value) status.textContent = 'We couldn’t suggest a country. Choose one to load city suggestions.';
    } finally {
      window.clearTimeout(timeout);
    }
  };

  cityInput.addEventListener('input', () => {
    if (cityInput.value.trim() !== selectedCity) {
      selectedCity = '';
      selectedCityCountry = '';
    }
    syncLocationValidity();
    const country = countries.find((item) => item.Iso2 === countrySelect.value);
    if (country && !citiesByCountry.has(country.Iso2)) void loadCities(country);
    renderSuggestions();
  });
  cityInput.addEventListener('focus', () => {
    const country = countries.find((item) => item.Iso2 === countrySelect.value);
    if (country && !citiesByCountry.has(country.Iso2)) void loadCities(country, true);
    else renderSuggestions();
  });
  cityInput.addEventListener('keydown', (event) => {
    const options = [...suggestions.querySelectorAll('[role="option"]')];
    if (event.key === 'Escape') {
      setSuggestionsOpen(false);
      return;
    }
    if (!options.length || suggestions.hidden) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      highlightedIndex = (highlightedIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[highlightedIndex].focus();
    }
  });
  suggestions.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setSuggestionsOpen(false);
      cityInput.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const options = [...suggestions.querySelectorAll('[role="option"]')];
      if (!options.length) return;
      highlightedIndex = (highlightedIndex + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      options[highlightedIndex].focus();
    }
  });
  countrySelect.addEventListener('change', () => {
    countryWasChosen = true;
    cityInput.value = '';
    selectedCity = '';
    selectedCityCountry = '';
    syncLocationValidity();
    void loadCities(countries.find((item) => item.Iso2 === countrySelect.value), true);
  });
  document.addEventListener('pointerdown', (event) => {
    if (!suggestions.contains(event.target) && event.target !== cityInput) setSuggestionsOpen(false);
  });
  form.addEventListener('reset', () => {
    window.setTimeout(() => {
      cityInput.value = '';
      selectedCity = '';
      selectedCityCountry = '';
      countryWasChosen = false;
      syncLocationValidity();
      setSuggestionsOpen(false);
      void detectCountry();
    }, 0);
  });

  fetch('assets/countries.json', { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok) throw new Error('Country list unavailable.');
      return response.json();
    })
    .then((data) => {
      countries = data.filter((item) => item && item.name && item.Iso2)
        .sort((left, right) => left.name.localeCompare(right.name));
      const fragment = document.createDocumentFragment();
      countries.forEach((country) => {
        const option = document.createElement('option');
        option.value = country.Iso2;
        option.textContent = country.name;
        fragment.append(option);
      });
      countrySelect.append(fragment);
      return detectCountry();
    })
    .catch(() => {
      status.textContent = 'Country options could not be loaded. Refresh the page and try again.';
    });
})();
