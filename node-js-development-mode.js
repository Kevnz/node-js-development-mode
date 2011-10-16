/*
 * This file is part of the Spludo Framework.
 * Copyright (c) 2009-2010 DracoBlue, http://dracoblue.net/
 *
 * Licensed under the terms of MIT License. For the full copyright and license
 * information, please see the LICENSE file in the root folder.
 */

/*
 * Node.js is a good peice of software, but it lacks a very critical feature: a "development" mode.
 * In "development" mode, if you modify your application code, it get applied "on the fly",
 * without the need to restart the application server.
 *
 * Development for Node.js under Windows, thus, has been a pain.
 * You had to go and change a line of code,
 * then go to the Node console window,
 * then close it by clicking the cross icon,
 * then go to Explorer and run "start node.js.bat",
 * and then go to your web browser and finally hit "Refresh"
 * just to find out if that modified line of code works.
 *
 * This script fixes that drawback, and is used to run Node.js in "development" mode.
 * Thanks to the Node community for helping me to make it work.
 *
 * Running:
 * node "c:\work\node-js-development-mode.js" --main-file "code\web\main.js"
 * or
 * node "c:\work\node-js-development-mode.js" --main-file "code\web\main.coffee" --coffee-script "c:\work\node\coffee-script\bin\coffee"
 *
 * You can also specify files, you want to watch, manually:
 *
 * node "c:\work\node-js-development-mode.js" --main-file "code\web\main.js" --files-to-watch "['*.js', '*.coffee']"
 *
 * I, personally, run Node.js with this script (I just double click it in Explorer)
 * "run node.js.bat":
 *
 * @echo off
 * title node.js
 * node "c:\work\node-js-development-mode\node-js-development-mode.js" --main-file code/web/main.coffee --coffee-script c:\work\node\coffee-script\bin\coffee
 * pause
 *
 * Make sure you've added path to the "node.exe" file to your system "Path" variable.
 * (right click "My computer", Properties, blah blah blah, Evironmental variables, find "Path" there, click "Edit", add ";" and path to "node.exe" without trailing slash, "OK")
 *
 * Known issue: you'll get "Error: write EINVAL", if you try to output to console (or to standard output, etc).
 *
 * This script was adapted for Windows by Nikolay Kuchumov (kuchumovn@gmail.com).
 * The script was initially created by DracoBlue (dracoblue.net) for Linux platform, and is part of the Spludo Framework.
 * Then I came by it on the internets:
 * http://dracoblue.net/dev/hot-reload-for-nodejs-servers-on-code-change/173/
 * and adapted it for my OS.
 * (It's windoze, cause I don't have money to buy a Mac. If you'd like to assist me in buying a Mac, just email me)
 *
 * You might want to check out
 * https://github.com/kuchumovn/node-js-development-mode
 * to issue an error report, or to request a feature, or to just get a new version.
 *
 * script version: 1.0.0
 * Licensed under the terms of MIT License.
 */
 
var child_process = require('child_process');
var fs = require("fs");
var sys = require("util");

function parse_options()
{
		var index
		var options = 
		{
			watched_file_paths: ['*.js', '*.coffee']
		}
		
		index = process.ARGV.indexOf('--main-file')
		if (index >= 0)
			options.main_file_path = process.ARGV[index + 1]
		
		index = process.ARGV.indexOf('--coffee-script')
		if (index >= 0)
			options.coffee_script_path = process.ARGV[index + 1]
			
		index = process.ARGV.indexOf('--files-to-watch')
		if (index >= 0)
			options.watched_file_paths = eval(process.ARGV[index + 1])
			
		index = process.ARGV.indexOf('--mute')
		if (index >= 0)
			options.mute = true
			
		//console.log(options)
		return options
}

dev_server = {

    process: null,

    files: [],

    restarting: false,
	
	file_path_regular_expression: /^[\x00-\x7F]*$/,

    "restart": function() {
        this.restarting = true;
        sys.debug('DEVSERVER: Stopping server for restart');
        this.process.kill();
    },

    "start": function() {
        var that = this;
		
		this.options = parse_options()
		
		var arguments
		if (this.options.coffee_script_path)
			arguments = [this.options.coffee_script_path, this.options.main_file_path]
		else
			arguments = [this.options.main_file_path]

        sys.debug('DEVSERVER: Starting server');
        that.watchFiles();
		
        this.process = child_process.spawn("node", arguments);

        this.process.stdout.addListener('data', function (data) {
			sys.print(data)
            process.stdout.write(data)
        })

        this.process.stderr.addListener('data', function (data) {
            sys.print(data)
        })

        this.process.addListener('exit', function (code) {
            sys.debug('DEVSERVER: Child process exited: ' + code);
            this.process = null;
            if (that.restarting) {
                that.restarting = true;
                //that.unwatchFiles();
                that.start();
            }
        });
    },

    "watchFiles": function() {
        var that = this;

		// get watched file list
        child_process.exec('dir /s /b ' + this.options.watched_file_paths.join(' '), function(error, stdout, stderr) {
			// windows line terminator
            var files = stdout.trim().split("\r\n");

			// watch each file for changes
			files.forEach(function(file) 
			{
				//console.log(file)
				if (!that.file_path_regular_expression.test(file))
				{
					if (!that.options.mute)
						console.error('File path "' + file + '" is unsupported. Skipping.')
					return
				}
				
                //file = file.replace(/\\/g, '\\\\')
				that.files.push(file);
				
                fs.watch(file,  function(action, fileName) {
					//console.log (action)
					if (action == 'change') {
                        sys.debug('DEVSERVER: Restarting because of changed file at ' + file);
                        dev_server.restart();
                    }
                });
            });
        });
   }
}

dev_server.start();