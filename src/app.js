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
