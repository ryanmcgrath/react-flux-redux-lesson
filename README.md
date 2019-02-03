# NOTICE
This tutorial uses outdated versions of webpack and webpack-dev-server. The logic and approach below should still work, but be sure to upgrade your dependencies!

# Class 2: Data Storage with React
Welcome back! In our last session we took an in-depth look at setting up your React development environment, making use of npm, Webpack, and Babel. In this session, we'll be building on top of that setup to build React applications that manage data storage. We'll be touching on the following points:

- Introduction to Flux, for data storage
- Simplying Flux with third party approaches
- Building a mini GitHub Repository viewer (Part 1)

You probably noticed that last point - our goal for this session is to build a miniature GitHub repository viewer! We'll be building this over the next two sessions; the focus for today is on the data storage and rendering portion, and we'll be tying on routing in the next session.


## A Quick Helper: Automatic Building and Reloading with Webpack
Before we dive in, let's set up one useful thing with Webpack - automatic building and reloading (at the end of our last session this was left as an exercise). Webpack can watch your source files for changes and automatically rebuild and reload your project as necessary. During development, this makes life much easier - it's a pretty straightforward change, too. Load up the simple application we built in Session 1 and take another look at our existing `webpack.config.js` file:

``` javascript
const path = require('path');
const PATHS = {
    src: path.join(__dirname + '/src'),
    dist: path.join(__dirname + '/dist'),
};

module.exports = {
    entry: ['babel-polyfill', path.join(PATHS.src, '/app.js')],

    resolve: {
        extensions: ['', '.js', '.jsx']
    },

    output: {
        path: PATHS.dist,
        filename: 'app.js'
    },

    module: {
        loaders: [{
            test: /\.jsx?$/,
            loader: 'babel',
            exclude: /node_modules/,
            include: PATHS.src,
            query: {
                cacheDirectory: true,
                presets: ['es2015', 'react']
            }
        }]
    }
};
```

This works great for building. To enable automatic rebuilding and reloading, though, we'll need a couple new plugins:

- `npm install --save-dev webpack-dev-server`
  - _This plugin is a lightweight in-memory development server for Webpack. It's used to serve files up and handle reloading changes._
- `npm install --save-dev babel-preset-react-hmre`
  - _This preset provides us the ability to use what's known as "Hot Module Reloading". We could use just `webpack-dev-server`, but each reload would be full - that is, state and properies would be entirely reset via a browser refresh. "Hot Module Reloading" is more dynamic in nature and will attempt to maintain state and properties via a Websocket._

Bringing this into our configuration file presents a point worth considering: isn't this getting to be a bit much to keep track of? For instance, sometimes you might need to just rebuild the project without running the development server. Maybe there's certain things we want to run _only_ in development? Luckily, we can logically separate things by making use of npm scripts in `package.json`:

``` javascript
    // We'll want to add the following lines somewhere in our package.json
    // You might have an existing (default) script in there concerning tests. Feel
    // free to remove them for now, as we'll cover testing options in Session 4.
    "scripts": {
        "build": "webpack",
        "start": "webpack-dev-server --inline --hot"
    }
```

Now a simple `npm build` or `npm start` will call the appropriate program. Running a script via npm provides us with a handy hook in our configuration file, via `process.env.npm_lifecycle_event` - we can detect whether we should return options for the pure build, or the development server. If the `process` object is new to you, fret not - it's just an object in Node with information related to the current running setup. For a full list of what it can tell you, check out the **[process documentation](https://nodejs.org/api/process.html)**.

Below you'll find a new (liberally commented) configuration. Feel free to poke through it, or skip past it for an in-depth explanation.

``` javascript
const path = require('path');
const PATHS = {
    src: path.join(__dirname + '/src'),
    dist: path.join(__dirname + '/dist'),
};

// The "default" configuration, options that work for both
// the default build process as well as the development server
const config = {
    entry: ['babel-polyfill', path.join(PATHS.src, '/app.js')],

    resolve: {
        extensions: ['', '.js', '.jsx']
    },

    output: {
        path: PATHS.dist,
        filename: 'app.js'
    },

    module: {
        loaders: [{
            test: /\.jsx?$/,
            loader: 'babel',
            exclude: /node_modules/,
            include: PATHS.src,
            query: {
                cacheDirectory: true,
                presets: ['es2015', 'react']
            }
        }]
    }
};

// "start" is just the name of the script in our package.json for the
// development server. Customize it here as necessary.
if(process.env.npm_lifecycle_event === 'start') {
    // We don't need or want to run hot-module-replacement code in
    // ordinary build processes, so we'll push it into the presets stack here.
    config.module.loaders[0].query.presets.push('react-hmre');

    // Configure our development server
    config.devServer = {
        contentBase: __dirname,
        hot: true,
        progress: true,
        stats: 'errors-only',
        host: process.env.HOST,
        port: process.env.PORT
    };
}

// Good to go!
module.exports = config;
```

This is still pretty manageable; we've just moved our common configuration into an object, and we now add a few extra things if we're running the `npm start` script. Some specific notes:

- `inline` in the start script in package.json injects code into your bundle to handle the hot-reloading process in the browser.
  - _We specify this option in the `package.json` start script, as it's (at time of writing this) not a supported option in the `devServer` configuration object._
  - _Some guides and tutorials around the internet indicate it is, but the official Webpack documentation explicitly states it's not supported._
- The development server only stores generated code in memory; you'll need to run a `build` to store generated code into `dist/app.js`.

Now, since we're loading our code from a server, we'll need to edit our `index.html` file. Change the `<script></script>` tag to reference a relative path - for webpack-dev-server, the default is simply `/`:

``` html
<script type="text/javascript" src="/app.js"></script>
```

Fire up the development server with an `npm start`, and load up the address (the default should wind up being http://localhost:8080/) in your browser. Edit our component from Session 1, and change the button text - Webpack should catch the change and rebuild, and your browser should automatically load it up. No more executing your build command every time.
 
>_**Note:** Windows users can experience issues with this setup, but the reasoning is varied in nature. An often used fix is to change the `start` script to `webpack-dev-server --watch-poll --inline`. This taxes the filesystem a bit more as it polls over and over again for changes, but it's been known to work for many users._

## Introduction to Flux
The top-down approach to building React applications can be a bit confusing at first once you start considering how to manage data. The most widely used approach with React is what's known as **[Flux](https://facebook.github.io/flux/docs/overview.html)**, an application architecture that Facebook developed in tandem with React. It's not necessarily a full-fledged framework, but moreso a pattern for handling data flow within your applications. Several third party packages exist to make this easier to run with, but we'll go over the core of Flux first.

### Pub/Sub
The best way to think of Flux is that it establishes relationships between _Publishers_ and _Subscribers_. Data flows in one direction (Publisher), and Subscribers take what they need. In this respect, when building React applications your data stores tend to be very top-level. Your components may choose to subscribe to one or more data stores, and they'll update as the stores publish new data.

A typical Flux setup can be broken down into a few pieces:

- **Actions**
  - Functions you call to interact with the Dispatcher and Stores.
  - Actions are plain old JavaScript Objects and Functions, used to abstract common Dispatcher calls.
- **Dispatcher**
  - In a typical Flux architecture, you should only ever have (at most) 1 of these.
  - Subscribers say what they're interested in, and the Dispatcher will pass it along.
  - Facebook provides a Dispatcher implementation in Flux that can be used (`flux.Dispatcher`).
- **Stores**
  - Where your data is stored, and where your AJAX calls and such should most likely occur.
  - Stores subscribe to the Dispatcher, and respond when an event is triggered from upstream.
  - We can use the Node.js `events` built-in library to manage our Store events.
- **Views**
  - Your components! Views listen (subscribe) to Stores and update as Stores emit change events.
  - Views can also call actions, essentially restarting the chain at the Dispatcher level.

A Flux setup would end up looking something like the following - it's a simple TODO list, commented liberally from the top down. It illustrates the
architecture choices of Flux a bit more. Actions act as a uniform dispatcher access point from components, and listening to changes on the store kicks
the render process into gear when necessary.

``` javascript
import React from 'react';
import {render} from 'react-dom';
import flux from 'flux';
import {EventEmitter} from 'events';

/**
 *  ITEMS is our global data store, and we create
 *  a dispatcher to handle alerting possible subscribed stores.
 */
const ITEMS = [];
const dispatcher = new flux.Dispatcher();


/**
 *  We create a store by riding on top of EventEmitter, which gives
 *  us built-in event publication/subscription capabilities.
 */
const store = Object.assign({}, EventEmitter.prototype, {
    addChangeListener: function(callback) {
        this.on('change', callback);
    },

    getAllItems: function(username, repo) {
        return ITEMS;
    }
});


/**
 *  We register the store with the dispatcher, so it receives all
 *  dispatches and can choose whether to do something with the data
 *  or not. In this case, if the payload.event is ADD_ITEM, we'll
 *  call our function inside the actions object below, which puts our
 *  TODO name to the top of the list.
 */
store.dispatchToken = dispatcher.register(function(payload) {
    var actions = {
        ADD_ITEM: function(payload) {
            ITEMS.unshift(payload.data.name);
            store.emit('change');
        }
    };

    if(actions[payload.event])
        actions[payload.event](payload);
});


/**
 *  Our global actions object - the public access point for
 *  getting the store and dispatcher to kick it.
 */
const actions = {
    addItem: function(name) {
        dispatcher.dispatch({
            event: 'ADD_ITEM',
            data: {name: name}
        });
    }
};


/**
 *  A generic App component, which listens for new TODO items
 *  and passes over input ones through actions.
 */
class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {items: store.getAllItems()};
        this.onKeyUp = this.onKeyUp.bind(this);
        this.updateList = this.updateList.bind(this);
    }

    componentDidMount() {
        store.addChangeListener(this.updateList);
    }

    updateList() {
        this.setState({items: store.getAllItems()});
    }

    onKeyUp(e) {
        // 13 = Enter key
        if(e.keyCode !== 13)
            return;

        actions.addItem(this.refs.input.value);
        this.refs.input.value = '';
    }

    render() {
        return (<div className="wrapper">
            <input type="text" onKeyUp={this.onKeyUp} ref="input" placeholder="Enter a TODO" />
            <ul>
                {this.state.items.map(function(item, i) {
                    return <li key={i}>{item}</li>;
                })}
            </ul>
        </div>);
    }
}

render(<App />, document.getElementById('app'));
```

Now, one thing you've likely noticed - this is crazy verbose! Implementing this from scratch on every new project isn't quite fun, so let's make use of a third party Flux library to cut down on the boilerplate code. There are a few noteworthy options to choose from:

- **[Redux](http://rackt.org/redux/index.html)**
  - Currently the most popular Flux framework.
- **[Reflux](https://github.com/reflux/refluxjs)**
  - A Flux approach that turns Actions into Dispatchers, instead of having one single Dispatcher
- **[Alt](https://github.com/goatslacker/alt)**
  - A Flux framework built for terseness.

We'll go ahead and use Redux for the rest of this tutorial due to its popularity, but feel free to poke around and see what works for you. The Node.js and React community moves fast, so there's always new and interesting approaches being explored.


### Slimming Down with Redux
Installing Redux is easy - `npm install --save redux` and you're good to go! Let's take a quick look at how Redux differs from traditional Flux:

- **Differences Between Flux and Redux**
  - Redux has no Dispatcher
  - Redux has _one_ store for your application, whereas Flux can have many.
  - Everything that happens inside your application is considered an Action.
  - Redux opts for more functional composition, whereas Flux centers on callbacks.
  - Redux enforces a few contracts in terms of API design, whereas Flux is more flexible at the cost of verbosity.

#### TODO in Redux
The Redux documentation puts it very well:

> If you’re coming from Flux, there is a single important difference you need to understand. Redux doesn’t have a Dispatcher or support many stores. Instead, there is just a single store with a single root reducing function. As your app grows, instead of adding stores, you split the root reducer into smaller reducers independently operating on the different parts of the state tree. This is exactly like there is just one root component in a React app, but it is composed out of many small components.

Now, the standout piece here is... what's a reducer? Well, if an Action represents "______ happened", you can liken a Reducer to an instruction as to how the data should update according to that action. For example, here's how we could implement the Flux solution we just built above, in Redux:


``` javascript
import React from 'react';
import {render} from 'react-dom';
import {createStore} from 'redux'

/**
 *  Our ITEMS, and our store. Redux works on Reducers, which correspond
 *  to Actions. In this example, the Reducer for the ADD_ITEM Action is
 *  duplicating the ITEMS Array and shoving the new TODO name in front.
 *
 *  Note that Reducers always need to return new objects; you cannot modify
 *  or mutate the passed-in state.
 */
const ITEMS = [];
const store = createStore(function(state, action) {
    switch(action.type) {
        case 'ADD_ITEM':
            return [action.name].concat(state);

        default:
            return state;
    }
}, ITEMS); // Passing ITEMS here makes it the default store data. Syntactic sugar.
```

Well, we're no longer swimming in boilerplate at least. This is how we'd handle our store in Redux - our `ITEMS` Array is the source of truth, and the store is simply a function that, given the current state and an action, returns a different state. This could be expanded to include other actions, but for brevity we're just going to concern ourselves with adding.

Note that we return a brand new Array; in Redux, Reducer functions cannot under any circumstances mutate the existing state. Behind the scenes Redux relies on you returning a new Object. Here we create a new Array by concatenating the existing state into a new Array, but you could do this with Objects too:

``` javascript
// For example, if the top level is an Object
const DATA = {ITEMS: []};
const store = createStore(function(state, action) {
    switch(action.type) {
        case 'ADD_ITEM':
            let data = Object.assign({}, DATA);
            data.ITEMS.unshift(action.name);
            return data;

        default:
            return state;
    }
}, DATA); 
```

You might have noticed we pass our ITEMS to the store as a second parameter - this stores them as the default state for the store without us needing to write any extra code to do so. Actions are also assumed to always have a `type` property - this is one of the few requirements of Redux. They're plain old Objects at the end of the day, so you can write Action creation functions if you like, or pass them inline to your store dispatch methods.

``` javascript
function addItem(name) {
    return {type: 'ADD_ITEM', name: name};
}

store.dispatch(addItem('Take out Garbage'));

// Alternatively
store.dispatch({
    type: 'ADD_ITEM',
    name: 'Take out Garbage'
});
```

Altogether we come down to this simple TODO when we do it with Reflux:

``` javascript
import React from 'react';
import {render} from 'react-dom';
import {createStore} from 'redux'
import {Provider} from 'react-redux'

/**
 *  Our ITEMS, and our store. Redux works on Reducers, which correspond
 *  to Actions. In this example, the Reducer for the ADD_ITEM Action is
 *  duplicating the ITEMS Array and shoving the new TODO name in front.
 *
 *  Note that Reducers always need to return new objects; you cannot modify
 *  or mutate the passed-in state.
 */
const ITEMS = [];
const store = createStore(function(state, action) {
    switch(action.type) {
        case 'ADD_ITEM':
            return [action.name].concat(state);

        default:
            return state;
    }
}, ITEMS); // Passing ITEMS here makes it the default store data. Syntactic sugar.

/**
 *  A generic App component, which listens for new TODO items
 *  and passes over input ones through actions.
 */
class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {items: store.getState()};
        this.onKeyUp = this.onKeyUp.bind(this);
        this.updateList = this.updateList.bind(this);
    }

    componentDidMount() {
        this.unsubscribe = store.subscribe(this.updateList);
    }

    updateList() {
        this.setState({items: store.getState()});
    }

    onKeyUp(e) {
        // 13 = Enter key
        if(e.keyCode !== 13)
            return;

        store.dispatch({
            type: 'ADD_ITEM',
            name: this.refs.input.value
        });
        this.refs.input.value = '';
    }

    render() {
        return (<div className="wrapper">
            <input type="text" onKeyUp={this.onKeyUp} ref="input" placeholder="Enter a TODO" />
            <ul>
                {this.state.items.map(function(item, i) {
                    return <li key={i}>{item}</li>;
                })}
            </ul>
        </div>);
    }
}

render(<App />, document.getElementById('app'));
```

## Building a mini GitHub Repository Viewer
We've taken a look at a traditional Flux architecture, examined some alternatives, and scoped out Redux. Our examples have so far been straightforward in nature, though - let's kick it up a notch and build something that pulls in data over the network, and refreshes as the user changes things. We'll build a GitHub repository commit log viewer - it's straightforward enough to nail down the basics of, and leaves us room to expand when we hit `react-router` in the next session.

We'll go ahead and structure our application as follows:

- `src`
  - `app.js`
  - `components`
    - `repository-index.js`
    - `commit-message.js`
  - `stores`
    - `actions.js`
    - `store.js`

...and start out by knocking together our actions and store. Since we'll be making some network requests and tying it into our Redux store, we'll want to go ahead and install two new libraries - `xhr`, and `redux-thunk`. `xhr` is a fairly standard network call wrapper, and redux-thunk allows us to write Actions that can return Functions. Since Redux dispatches go through the store itself, we'll need to patch the store before writing our Actions - open up `store.js` and take a look at the following:

``` javascript
import {createStore, applyMiddleware} from 'redux';
import thunk from 'redux-thunk'; 
import {LOAD_REPOSITORY} from './actions';

const createStoreWithMiddleware = applyMiddleware(thunk)(createStore);

const store = createStoreWithMiddleware(function(state, action) {
    switch(action.type) {
        case LOAD_REPOSITORY:
            let newState = Object.assign({}, state);
            if(!newState[action.username])
                newState[action.username] = {};
            newState[action.username][action.repo] = action.commits;
            return newState;
        
        default:
            return state
    }
}, {});

export default store;
```

Now, before we create our store, we apply the `thunk` middleware to the `createStore` method. This patches everything up for easy AJAX handling. We're also importing a `LOAD\_REPOSITORY` Action, which we'll move on and implement in `actions.js`:

``` javascript
import xhr from 'xhr';

export const LOAD_REPOSITORY = 'LOAD_REPOSITORY';

export const loadRepository = function(username, repo) {
    return function(dispatch) {
        let url = 'https://api.github.com/repos/' + username + '/' + repo + '/commits';
        xhr.get(url, {json: true}, function(error, response, body) {
            dispatch({
                type: LOAD_REPOSITORY,
                username: username,
                repo: repo,
                commits: body
            });
        });
    };
};

```

Here, we're exporting two objects. `LOAD\_REPOSITORY` is a constant for reuse across the application - reusing Strings across your application as it grows quickly becomes unwieldy when you need to make change. `loadRepository` is a `redux-thunk`'ified Action. We return a Function that gets passed the dispatch method directly, which we can call when our network job is complete to loop it all back around to the store. Once our request to GitHub returns, we pass off the results to our store by dispatching it all.

The results that we get back from GitHub can be **[read about further](https://developer.github.com/v3/repos/commits/)**, but the general format is this:

``` javascript
[{
    "url": "",
    "sha": "",
    "html_url": "",
    "comments_url": "",
    "commit": {/*...*/},
    "author": {/*...*/},
    "committer": {/*...*/},
    "parents": {/*...*/}
} /*...*/]
```

What we primarily want to display today is commit information, but we'll go ahead and display their avatar as well (feel free to customize it to your liking). Let's rig up `components/commit-message.js`:

``` javascript
import React from 'react';

var defaultGravatar = 'http://www.gravatar.com/avatar/205e460b479e2e5b48aec07710c08d50?f=y';

class CommitMessage extends React.Component {
    render() {
        var avatar = this.props.commit.author ? this.props.commit.author.avatar_url : defaultGravatar;

        return (<li className="commit">
            <img src={avatar} width="50" height="50" />
            <h2 className="author">{this.props.commit.commit.author.name}</h2>
            <p className="message">{this.props.commit.commit.message}</p>
            <p className="date">{this.props.commit.commit.author.date}</p>
        </li>);
    }
}

export default CommitMessage;
```

> There's a default gravatar URL here as sometimes GitHub avatar URLs go wonky and don't show up. There's also no default CSS, but you can grab the example CSS in this repository or throw togeter some of your own.

This component is really straightforward - we're just laying out and display the information that comes back from GitHub. We've gotta display it for each commit, though - it's time to hook up `components/repository-index.js`:

``` javascript
import React from 'react';
import store from '../store/store';
import {loadRepository} from '../store/actions';
import CommitMessage from './commit-message';

class RepositoryIndex extends React.Component {
    constructor(props) {
        super(props);

        let data = store.getState(),
            commits;
        
        if(data[this.props.username])
            commits = data[this.props.username][this.props.repo]; 

        this.state = {history: commits ? commits : []};
        this.updateRepo = this.updateRepo.bind(this);
    }

    componentDidMount() {
        this.unsubscribe = store.subscribe(this.updateRepo);
        store.dispatch(loadRepository(this.props.username, this.props.repo));
    }

    componentWillReceiveProps(newProps) {
        store.dispatch(loadRepository(newProps.username, newProps.repo));
    }

    componentWillUnmount() {
        this.unsubscribe();
    }

    updateRepo(history) {
        let data = store.getState(),
            commits;

        if(data[this.props.username])
            commits = data[this.props.username][this.props.repo];
        
        this.setState({history: commits ? commits : []});
    }

    render() {
        return <ul className="repository">
            {this.state.history.map(function(commit, i) {
                return <CommitMessage commit={commit} key={i} />;
            })}
        </ul>;
    }
};

export default RepositoryIndex;
```

Nothing too new here, with the exception of two points:

- We do a bit of logic inside `updateRepo()` and the `constructor`, just to match up in our data structure where the repos for the selected user is.
- Our `render()` method maps over our commit history and returns a CommitMessage for each entry. We pass in the commit as a property, and we also pass a `key` - React requires entries in a loop like this to have a key for performance reasons, so it can identify unique entries.

That's all the necessary component files and store files - now we'll just circle back to `app.js` and tie it off:

``` javascript
import React from 'react';
import {render} from 'react-dom';
import RepositoryIndex from './components/repository-index';

class App extends React.Component {
    constructor(props) {
        super(props);
        this.state = {username: 'ryanmcgrath', repo: 'twython'};
        this.handleKeyEvent = this.handleKeyEvent.bind(this);
    }
    
    handleKeyEvent(e) {
        if(e.key !== 'Enter')
            return;

        var data = this.refs.input.value.split('/');
        if(data.length !== 2)
            return alert('Bad input.');

        this.setState({
            username: data[0],
            repo: data[1]
        });
    }

    render() {
        return (<div id="app_wrapper">
            <input type="text" ref="input" placeholder={this.state.username + "/" + this.state.repo} onKeyUp={this.handleKeyEvent} />
            <RepositoryIndex username={this.state.username} repo={this.state.repo} />
        </div>);
    }
}

render(<App />, document.getElementById('app'));
```

Our base `App` has one new addition here. We've added an input element where a user can type a _username/repository_ combination to pull from. We do some (very) rudimentary error checking, but otherwise if the parameters fit we pass it off to our `RepositoryIndex` at rendering, where it'll kick over to the Redux store.

Check it out in your browser and see how it works!

## Wrapping Up
We've now built a React application that utilizes Flux (by way of Redux) to store data and handle network calls. In our next session, we'll be adding **[React Router](https://github.com/rackt/react-router)** into the mix to enable building full Single Page Applications (SPA). If you find yourself with questions or confusion about any of the material we went over in this article, reach out!
