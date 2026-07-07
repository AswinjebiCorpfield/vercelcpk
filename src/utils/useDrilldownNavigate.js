import { useLocation, useNavigate } from 'react-router-dom';

// Hierarchical drill-in navigation.
//
// Returns a navigate-like function that APPENDS a child segment to the current
// URL path instead of replacing it, so drilling into a chart builds a nested,
// self-describing URL:
//
//   /lot-cpk-bar
//     → drill('individual-lot-clicked-table')
//   /lot-cpk-bar/individual-lot-clicked-table
//     → drill('lots-sample-distribution-table')
//   /lot-cpk-bar/individual-lot-clicked-table/lots-sample-distribution-table
//
// The same detail page is reachable from several modules (Individual, Dimension,
// Historical, Key Focus); appending to the current path means the URL always
// records the real path the user took, and the NavBar can light up the correct
// module tab from the first segment. Router state (the clicked row/period) is
// still passed through `options.state` exactly as before.
export default function useDrilldownNavigate() {
  const navigate = useNavigate();
  const location = useLocation();
  return (childSegment, options) => {
    const base = location.pathname.replace(/\/+$/, ''); // strip trailing slash
    const seg = String(childSegment).replace(/^\/+/, ''); // strip leading slash
    navigate(`${base}/${seg}`, options);
  };
}
