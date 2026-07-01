// Captured live-API responses, bundled by webpack for the demo build.
// Each key maps to a route in resolver.mjs. To refresh against a live API,
// re-run scripts/capture-fixtures.sh (see repo notes) while the API is up.
import updateTime from './fixtures/update-time.json';
import filterOptions from './fixtures/filter-options.json';
import unifiedFilterOptions from './fixtures/unified-data-filter-options.json';
import unifiedDaily from './fixtures/unified-data__ACNCdata_daily.json';
import unifiedMonthly from './fixtures/unified-data__ACNCdata_monthly.json';
import overallAcNc from './fixtures/overall-lots-cpk-ppk-summary-ac-nc.json';
import ncRankTVC from './fixtures/unified-data-nc-rank__TVC.json';
import ncRankTAT from './fixtures/unified-data-nc-rank__TAT.json';
import materialRank from './fixtures/overall-lots-nc-rank__MaterialDesc.json';
import overallSummaryMonthly from './fixtures/overall-lots-cpk-ppk-summary-monthly.json';
import overallOneMonthDetail from './fixtures/overall-lots-one-month-detail.json';
import unifiedIndividualLot from './fixtures/unified-data__IndividualLot.json';
import subsamples from './fixtures/subsamples.json';
import subsamplesAll from './fixtures/subsamples-all.json';
import subsamplesFurnaceSummary from './fixtures/subsamples-furnace-summary.json';
import subsamplesNcAll from './fixtures/subsamples-nc-all.json';
import subsamplesMetrics from './fixtures/subsamples-calculate-subsample-metrics.json';

export const fixtures = {
  updateTime,
  filterOptions,
  unifiedFilterOptions,
  unifiedDaily,
  unifiedMonthly,
  overallAcNc,
  ncRankTVC,
  ncRankTAT,
  materialRank,
  overallSummaryMonthly,
  overallOneMonthDetail,
  unifiedIndividualLot,
  subsamples,
  subsamplesAll,
  subsamplesFurnaceSummary,
  subsamplesNcAll,
  subsamplesMetrics,
};
