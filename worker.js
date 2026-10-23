import { simulate } from './engine.js';
self.onmessage = ({ data }) => {
  try {
    const results = data.firms.map(firm => simulate({ firm, ...data.scenario }));
    self.postMessage({ requestId: data.requestId, results });
  } catch (error) {
    self.postMessage({ requestId: data.requestId, error: error.message });
  }
};
