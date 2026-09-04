import test from 'node:test';
import assert from 'node:assert/strict';
import { semanticAuthPath } from '../src/main/resources/static/js/app.js';

/** authorizationRequired 時需導向本站 OAuth start endpoint。 */
test('semanticAuthPath builds a same-site OAuth start path', () => {
  const path = semanticAuthPath({ result: { research: { coverage: { authorizationRequired: true } } } }, {
    pathname: '/case', search: '?locale=zh-TW'
  });
  assert.equal(path, '/api/auth/tw-legal-rag/start?returnTo=%2Fcase%3Flocale%3Dzh-TW');
});

/** callback 返回帶 mcpAuth 時不得再次自動導向造成 redirect loop。 */
test('semanticAuthPath ignores callback return', () => {
  const path = semanticAuthPath({ result: { research: { coverage: { authorizationRequired: true } } } }, {
    pathname: '/', search: '?mcpAuth=success'
  });
  assert.equal(path, null);
});

/** semantic disabled 或成功時不產生 OAuth navigation。 */
test('semanticAuthPath is empty when authorization is not required', () => {
  assert.equal(semanticAuthPath({ result: { research: { coverage: { authorizationRequired: false } } } }), null);
});
