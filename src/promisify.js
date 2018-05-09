const Nightwatch = {
  Assertion: require('nightwatch/lib/core/assertion')
};

function promisifyApi(api, runQueue) {
  let _successCb, _catchCb;
  api.catch = catchCb => {
    if (catchCb) _catchCb = catchCb;
  };
  api.then = (successCb, catchCb) => {
    if (successCb) _successCb = successCb;
    if (catchCb) _catchCb = catchCb;
    return runQueue()
      .then(_successCb)
      .catch(_catchCb);
  };
}

function promisifyAssertions(runQueue) {
  const promise = {};
  promisifyApi(promise, runQueue);
  const originalAssert = Nightwatch.Assertion.assert;

  Nightwatch.Assertion.assert = function() {
    return promise.then(() => originalAssert.apply(this, arguments));
  };
}

function promisifyExpect(api, runQueue) {
  if (!api.expect) return;
  ['element', 'section'].forEach(field => {
    const originalExpectation = api.expect[field];

    api.expect[field] = function() {
      const result = originalExpectation.apply(this, arguments);
      promisifyApi(result, runQueue);
      return result;
    };
  });
}

function promisifySection(section, runQueue) {
  promisifyApi(section, runQueue);
  promisifyExpect(section, runQueue);
  if (section.section) {
    Object.keys(section.section).forEach(key => {
      promisifySection(section.section[key], runQueue);
    });
  }
}

function promisifyChildPageObjects(page, runQueue) {
  Object.keys(page).forEach(key => {
    if (typeof page[key] !== 'function') {
      promisifyChildPageObjects(page[key], runQueue);
    } else {
      const originalPageCreator = page[key];
      page[key] = function() {
        const page = originalPageCreator.call(this);
        promisifySection(page, runQueue);
        return page;
      };
    }
  });
}

function promisifyPageObjects(api, runQueue) {
  if (api.page) {
    return promisifyChildPageObjects(api.page, runQueue);
  }
}

module.exports = {
  promisifyApi,
  promisifyAssertions,
  promisifyExpect,
  promisifyPageObjects
};