// Fixed synthetic legitimate requests for the held-out false-positive challenge (A-05).
// These are examples chosen by construction, not observations or real-world frequencies.
export const HARD_CASES = [
  {
    request: { method: 'GET', path: '/search', params: { q: "O'Brien's order", page: '3' } },
    label: 'legit',
    kind: 'search',
    variant: 'hard',
  },
  {
    request: {
      method: 'POST',
      path: '/profile',
      params: { email: 'sample1@example.com', bio: '東京 café مرحبا — merci!' },
    },
    label: 'legit',
    kind: 'profile',
    variant: 'hard',
  },
  {
    request: {
      method: 'POST',
      path: '/comments',
      params: { name: 'Noa', body: 'Please check the order, thank you! '.repeat(45) },
    },
    label: 'legit',
    kind: 'comments',
    variant: 'hard',
  },
  {
    request: {
      method: 'GET',
      path: '/search',
      params: { q: 'café: €12.50? https://example.com/item', page: '12' },
    },
    label: 'legit',
    kind: 'search',
    variant: 'hard',
  },
];
