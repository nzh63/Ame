import { app } from 'electron';
import { after } from 'mocha';

after(function() {
    app.exit();
});
