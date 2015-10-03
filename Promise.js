/*
    Really small implementation of Promises
    Exposes only chainable then & catch
 */
module.exports = Promise;

function Promise(resolver) {
    if (typeof resolver !== 'function') {
        throw new Error('Promise constructor parameter must be a function.');
    }

    this._callbacks = [];
    this._catchers = [];
    this.running = true;
    this._lastValue = undefined;

    this._errCaught = [];

    try {
        resolver(this.resolve.bind(this), this.reject.bind(this));
    } catch (e) {
        this.reject(e);
    }

};

// run the next function in the pipe
Promise.prototype.run = function(toRun, args) {
    var res = null,
        self = this;

    if (typeof toRun === 'function') {
        self.running = true;

        try {
            res = toRun.apply(null, args);
            this._lastValue = res; // save last value for future .then
        } catch (e) {
            self.reject(e); // catch errors
        }

        self.resolve(res);
    }

};

Promise.prototype.resolve = function() {
    var self = this;

    self.running = false;

    var args = Array.prototype.slice.call(arguments);
    this._lastValue = args[0] || undefined; // save last returned value for future .then

    var next = self._getNextCallback();
    if (next) {
        if (this._lastValue && this._lastValue instanceof Promise) {
            this._lastValue
                .then(this.run.bind(this, next))
                .catch(self.reject.bind(self));
        } else {
            this.run(next, args);
        }
    }

    return this;
};

Promise.prototype.reject = function(err) {
    err = err || new Error('An error occured');
    if (this._caught) {
        this._errCaught.push(err);
        this._caught(err);
    } else {
        throw new Error(err);
    }

    return this;
};

Promise.prototype.then = function(callback) {
    if (typeof callback !== 'function') {
        throw new Error('Promise.then need a function as parameter.');
    }

    this._addCallback(callback);
    if (!this.running) {
        this.resolve(this._lastValue);
    }

    return this;
};

Promise.prototype.catch = function(catcher) {
    if (typeof catcher !== 'function') {
        throw new Error('Promise.catch callback must be a function.');
    }

    var types = [];
    if (arguments.length === 1) {
        types = [Error];
    } else {
        var len = arguments.length,
            i = 0;
        for (i = 0; i < len - 1; ++i) {
            types.push(arguments[i]);
        }
        catcher = arguments[i];
    }

    types.forEach(function(type) {
        if (type !== Error && !(type.prototype instanceof Error)) {
            throw new Error('Promise.catch types must all be an Error type constructor.');
        }
    })

    var added = this._catchers.push({
        types: types,
        fn: catcher
    });

    if (this._errCaught.length) {
        this._testCaught(this._catchers[added]);
    }

    return this;
};

Promise.prototype._testCaught = function(catchers) {
    this._errCaught.forEach(function(err) {
        this._caught(err, catchers);
    }.bind(this));
};
Promise.prototype._caught = function(err, catchers) {
    catchers = catchers || this._catchers;
    var some = false;

    for (var i = 0; i < catchers.length; i++) {
        some = catchers[i].types.some(function(type) {
            return (err instanceof type);
        });

        if (some) {
            catchers[i].fn(err);
        }
    }
};

Promise.prototype._getNextCallback = function() {
    var next = null;
    if (this._callbacks.length) {
        next = this._callbacks.shift();
    }
    return next;
};

Promise.prototype._addCallback = function(callback) {
    this._callbacks.push(callback);
};

Promise.resolve = function(arg) {
    return new Promise(function(resolve, reject) {
        resolve(arg);
    });
};

Promise.reject = function(err) {
    return new Promise(function(resolve, reject) {
        reject(err);
    });
};

Promise.all = function (promises) {
    var results = [],
        resolved = 0,
        total = promises.length;
    return new Promise(function (resolve, reject) {
        promises.forEach(function (promise, index) {
            promise.then(function (value) {
                resolved++;
                results[index] = value;
                if (resolved === total) {
                    resolve(results);
                }
            }).catch(function (e) {
                reject(e);
            });
        })
    })
};