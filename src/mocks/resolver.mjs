// Pure, environment-agnostic mock resolver for the PCM demo build.
//
// Deliberately has NO webpack- or node-specific imports (no JSON imports, no
// axios) so the exact same logic runs both inside the CRA bundle and in a
// plain Node self-test. The caller injects the `fixtures` map (see fixtures.js
// for the bundled version, or the Node self-test which reads the JSON via fs).
//
// Each route below corresponds to a real endpoint the dashboards call against
// `window.baseURL`. Responses were captured from the live API (see
// src/mocks/fixtures/*.json) so the demo shows real-shaped, real-valued data
// with no backend.

export function routeOf(config) {
  const url = (config && config.url) || '';
  // Strip protocol+host and any query string, normalise trailing slash.
  return url.replace(/^https?:\/\/[^/]+/i, '').split('?')[0].replace(/\/+$/, '') || '/';
}

function parseBody(config) {
  const d = config && config.data;
  if (!d) return {};
  if (typeof d === 'string') {
    try { return JSON.parse(d); } catch (e) { return {}; }
  }
  return d;
}

function getParam(config, key) {
  const p = (config && config.params) || {};
  return p[key];
}

// Returns the fixture data for a request, or `undefined` if no fixture is
// mapped for that route/params combination yet.
export function resolveFixture(fixtures, config) {
  const route = routeOf(config);
  switch (route) {
    case '/update-time':
      return fixtures.updateTime;
    case '/filter-options':
      return fixtures.filterOptions;
    case '/unified-data-filter-options':
      return fixtures.unifiedFilterOptions;
    case '/unified-data': {
      const body = parseBody(config);
      // Component callers are inconsistent about casing (dataType vs DataType).
      const t = body.dataType || body.DataType;
      if (t === 'ACNCdata_daily') return fixtures.unifiedDaily;
      if (t === 'ACNCdata_monthly') return fixtures.unifiedMonthly;
      if (t === 'IndividualLot') return fixtures.unifiedIndividualLot;
      return []; // drill-down unified-data variants not captured yet
    }
    case '/overall-lots-cpk-ppk-summary-monthly':
      return fixtures.overallSummaryMonthly;
    case '/overall-lots-one-month-detail':
      return fixtures.overallOneMonthDetail;
    case '/subsamples':
      return fixtures.subsamples;
    case '/subsamples/all':
      return fixtures.subsamplesAll;
    case '/subsamples/furnace-summary':
      return fixtures.subsamplesFurnaceSummary;
    case '/subsamples/nc-all':
      return fixtures.subsamplesNcAll;
    case '/subsamples/calculate-subsample-metrics':
      return fixtures.subsamplesMetrics;
    case '/overall-lots-cpk-ppk-summary-ac-nc':
      return fixtures.overallAcNc;
    case '/unified-data-nc-rank': {
      const d = getParam(config, 'datatype');
      if (d === 'TVC') return fixtures.ncRankTVC;
      if (d === 'TAT') return fixtures.ncRankTAT;
      return [];
    }
    case '/overall-lots-nc-rank':
      return fixtures.materialRank;
    default:
      return undefined;
  }
}

// Builds an axios adapter that answers every request from `fixtures`.
// Unmapped routes resolve to `[]` (with a console warning) so the demo never
// crashes on a not-yet-captured drill-down.
export function createMockAdapter(fixtures, opts) {
  const options = opts || {};
  const latency = options.latency == null ? 100 : options.latency;
  return function mockAdapter(config) {
    const data = resolveFixture(fixtures, config);
    const resolved = data === undefined ? [] : data;
    if (data === undefined && options.warn !== false) {
      // eslint-disable-next-line no-console
      console.warn('[mock] no fixture for', ((config && config.method) || 'get').toUpperCase(), routeOf(config), '— returning []');
    }
    const response = {
      data: resolved,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json' },
      config: config,
      request: {},
    };
    return new Promise(function (resolve) {
      if (latency > 0) setTimeout(function () { resolve(response); }, latency);
      else resolve(response);
    });
  };
}
