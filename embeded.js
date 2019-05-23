// Use test server in available in devMode
if (isDevMode) {
  fetch(testServer + 'test.json')
    .then(function(response) {
      if (response.ok) {
        window.server = testServer
      } else {
        window.server = prodServer
      }
    })
}
