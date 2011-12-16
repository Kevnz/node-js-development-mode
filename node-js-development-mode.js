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
 * This script fixes that drawback, and is used to run Node.js in "development" mode (works since version 0.5.10 of Node.js).
 * Thanks to the Node community for helping me to make it work.
 *
 * Running:
 * node "c:\work\node-js-development-mode.js" --main-file "code\web\main.js"
 * or
 * node "c:\work\node-js-development-mode.js" --main-file "code\web\main.coffee" --coffee-script "c:\work\node\coffee-script\bin\coffee"
 *
 * You can also specify files, you want to watch (and to ignore), manually (** and * are supported):
 *
 * node "c:\work\node-js-development-mode.js" --main-file "code\web\main.js" --watch "['*.js', '*.coffee']"
 *
 * I, personally, run Node.js with this script (I just double click it in Explorer)
 * "run node.js.bat":
 *
 * @echo off
 * rem use utf-8 encoding in console output:
 * chcp 65001
 * title node.js
 * node "c:\work\node-js-development-mode\node-js-development-mode.js" --main-file code/web/main.coffee --coffee-script c:\work\node\coffee-script\bin\coffee --watch "['codeSLASH**SLASH*.js', 'codeSLASH**SLASH*.coffee']"
 * pause
 *
 * Known gotcha: you must run your *.bat file from the root directory of your app - from there on the "dir" command will search for the files.
 *
 * Make sure you've added path to the "node.exe" file to your system "Path" variable.
 * (right click "My computer", Properties, blah blah blah, Evironmental variables, find "Path" there, click "Edit", add ";" and path to "node.exe" without trailing slash, "OK")
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
 
var child_process = require('child_process')
var fs = require("fs")
var sys = require("util")

var debug_mode = true
var separator = '/'

function parse_options()
{
	var index
	var options = 
	{
		watched_paths: ['*.js', '*.coffee'],
		ignored_paths: []
	}
	
	index = process.argv.indexOf('--main-file')
	if (index >= 0)
		options.main_file_path = process.argv[index + 1]
	
	index = process.argv.indexOf('--coffee-script')
	if (index >= 0)
		options.coffee_script_path = process.argv[index + 1]
		
	index = process.argv.indexOf('--watch')
	if (index >= 0)
		options.watched_paths = eval(process.argv[index + 1])
		
	index = process.argv.indexOf('--ignore')
	if (index >= 0)
		options.ignored_paths = eval(process.argv[index + 1])
		
	index = process.argv.indexOf('--debug')
	if (index >= 0)
		debug_mode = true
		
	//console.log(options)
	return options
}
		
dev_server = 
{
    process: null,

    files: [],

    restarting: false,
	
	//file_path_regular_expression: /^[\x00-\x7F]*$/,

    restart: function() 
	{
		this.restarting = true
        //debug('DEVSERVER: Stopping server for restart')
        this.process.kill()
    },

    start: function() 
	{
        var that = this
		
		this.options = parse_options()
		
		var arguments
		if (this.options.coffee_script_path)
			arguments = [this.options.coffee_script_path, this.options.main_file_path]
		else
			arguments = [this.options.main_file_path]

        debug('DEVSERVER: Starting server')

		that.watch_paths()
		
        this.process = child_process.spawn("node", arguments);

        this.process.stdout.addListener('data', function (data) 
		{
            process.stdout.write(data)
        })

        this.process.stderr.addListener('data', function (data) 
		{
            process.stderr.write(data)
        })

        this.process.addListener('exit', function (code) 
		{
			if (!that.restarting)
				debug('DEVSERVER: Child process exited: ' + code)
				
            that.process = null
			that.start()
        })
		
		if (this.restarting)
		{
			this.restarting = false
		
			if (this.needs_extra_restart)
			{
				debug('DEVSERVER: Files changed while restarting. Restarting again')
				this.needs_extra_restart = false
				this.restart()
			}
		}
    },
	
	watch_file: function(file)
	{
		debug("Watching file '" + file + "' for changes.")
	
		var that = this
	
		fs.watch(file, function(action, fileName) 
		{
			//console.log (action)
			if (action === 'change') 
			{
				if (that.restarting)
				{
					that.needs_extra_restart = true
					return
				}
					
				debug('DEVSERVER: Restarting because of changed file at ' + file)
				dev_server.restart()
			}
		})
	},

	normalize_path: function(path)
	{
		return path.replace(process.cwd(), '').substring(1)
	},
	
    watch_paths: function() 
	{
        var that = this

		find_all_files(process.cwd(), function(file) 
		{
			file = that.normalize_path(file)
			
			// if already processed this file - return
			if (that.files.indexOf(file) >= 0)
				return
				
			that.files.push(file)
			
			// new file detected

			// if doesn't match pattern - return
			if (!Path_matcher.matches(file, that.options.watched_paths))
				return
				
			// if is ignored - return
			if (Path_matcher.matches(file, that.options.ignored_paths))
				return
		
			that.watch_file(file)
		})
	
		/*
		// get watched file list
        child_process.exec('dir /s /b ' + this.options.watched_file_paths.join(' '), function(error, stdout, stderr) 
		{
			if (error)
			{
				error('DEVSERVER: Server start failed')
				console.error(stderr)
				return
			}
		
			// windows line terminator
            var files = stdout.trim().split("\r\n");

			// watch each file for changes
			files.forEach(function(file) 
			{
				if (that.files.indexOf(file) >= 0)
					return
					
				//console.log(file)
				if (!that.file_path_regular_expression.test(file))
				{
					//if (!that.options.mute)
					error('File path "' + file + '" is unsupported. Skipping.')
					return
				}
				
                //file = file.replace(/\\/g, '\\\\')
				that.files.push(file)
				
				that.watch_file(file)
            })
        })
		*/
   }
}

function debug(message)
{
	if (debug_mode)
		console.log(message)
}

function show_error(message)
{
	console.log('Error: ' + message)
}

function info(message)
{
	console.log(message)
}

function find_all_files(path, callback) 
{
	fs.stat(path, function(error, stats)
	{
		if (error)
			return show_error('Failed to retrieve stats for path: ' + path)
		
		if (stats.isDirectory())
		{
			fs.readdir(path, function(error, file_names) 
			{
				if (error)
					return show_error('Failed to read directory: ' + path)
				
				file_names.forEach(function(file_name) 
				{
					find_all_files(path + '/' + file_name, callback)
				})
			})
			return
		}
		
		//if (path.match(fileExtensionPattern))
		callback(path)
	})
}

var Path_matcher = 
{
	split: function(path)
	{
		return path.split(separator)
	},
	
	matches: function(path, patterns)
	{
		var i = 0
		while (i < patterns.length)
		{
			var pattern = patterns[i]
			
			if (this.matches_pattern(this.split(path), this.split(pattern)))
				return true
				
			i++
		}
		
		return false
	},

	matches_pattern: function(path_parts, pattern_parts)
	{
		if (path_parts.length === 0 && pattern_parts.length === 0)
			return true
	
		if (path_parts.length === 0 || pattern_parts.length === 0)
			return false
	
		//console.log('find unmatched result for ' + path_parts.join('/') + ' and ' + pattern_parts.join('/') + ' is:')
		var result = this.find_unmatched_parts(path_parts, pattern_parts)
		//console.dir(result)
		
		if (result.matches)
			return true
		
		if (result.nothing_matched)
			return false
			
		//console.log('rest_path_parts')
		//console.log(result.rest_path_parts)
			
		pattern_parts.shift()
		return this.matches_pattern(result.rest_path_parts, pattern_parts)
	},
	
	find_unmatched_parts: function(path_parts, pattern_parts, options)
	{
		var pattern = pattern_parts[0]
		
		if (pattern.indexOf('**') >= 0 && pattern !== '**')
			throw 'Illegal pattern: ' + pattern
		
		if (pattern === '**')
		{
			// clone
			var expanded_pattern_parts = pattern_parts.slice()
			// remove the '**'
			expanded_pattern_parts.shift()
			
			// add as many '*'s as we can, checking for match
			while (expanded_pattern_parts.length <= path_parts.length)
			{
				if (this.matches_pattern(path_parts, expanded_pattern_parts))
					return { matches: true }

				expanded_pattern_parts.unshift('*')				
			}
		
			return { nothing_matched: true }
		}

		if (!this.asterisks_match(path_parts[0], pattern))
			return { nothing_matched: true }
	
		path_parts.shift()
		
		return { rest_path_parts: path_parts }
	},
	
	assert: function(path, pattern)
	{
		if (!this.matches(path, pattern))
			throw 'Path_matcher broken: ' + path + ' didn\'t match ' + pattern
	},
	
	assert_not: function(path, pattern)
	{
		if (this.matches(path, pattern))
			throw 'Path_matcher broken: ' + path + ' shouldn\'t match ' + pattern
	},
	
	assert_error: function(path, pattern)
	{
		try
		{
			this.matches(path, pattern)
		}
		catch (error)
		{
			return
		}
		
		throw 'Path_matcher broken: ' + path + ' match with ' + pattern + ' should raise error'
	},
	
	asterisks_match: function(path, pattern, options)
	{
		options = options || {}
	
		var asterisk_index = pattern.indexOf('*')
		if (asterisk_index < 0)
		{
			if (!options.start_from_anywhere)
				return path === pattern
			else
				return path.indexOf(pattern) >= 0
		}

		var pattern_before_asterisk = pattern.substring(0, asterisk_index)
		var path_before_asterisk = path.substring(0, asterisk_index)
		
		var rest_path
		
		if (!options.start_from_anywhere)
		{
			if (path_before_asterisk !== pattern_before_asterisk)
				return false
				
			rest_path = path.substring(asterisk_index + 1)
		}
		else
		{
			var start_index = path_before_asterisk.indexOf(pattern_before_asterisk)
			if (start_index < 0)
				return false
				
			rest_path = path.substring(start_index + asterisk_index + 1)
		}
			
		var rest_pattern = pattern.substring(asterisk_index + 1)		
		return this.asterisks_match(rest_path, rest_pattern, { start_from_anywhere: true })
	}
}

RegExp.escape = function(string)
{
	var specials = new RegExp("[.*+?|()\\[\\]{}\\\\]", "g")
	return string.replace(specials, "\\$&")
}

String.prototype.replace_all = function(what, with_what)
{
	var regexp = new RegExp(RegExp.escape(what), "g")
	return this.replace(regexp, with_what)
}

Path_matcher.assert('test.js', ['*.js'])
Path_matcher.assert_not('test.js', ['*.coffee'])
Path_matcher.assert('test.js', ['*.js', '*.coffee'])
Path_matcher.assert('test.coffee', ['*.js', '*.coffee'])
Path_matcher.assert_not('test/test.js', ['*.js'])
Path_matcher.assert('test/test.js', ['test/*.js'])
Path_matcher.assert('test/test.js', ['*/*.js'])
Path_matcher.assert_not('test.js', ['*/*.js'])
Path_matcher.assert('test/test.js', ['test/te*.js'])
Path_matcher.assert('test/test.js', ['test/*e*.js'])
Path_matcher.assert_not('test/test.js', ['test/*est*.js'])
Path_matcher.assert_error('test.js', ['**.js'])
Path_matcher.assert('test.js', ['**/*.js'])
Path_matcher.assert('test/test.js', ['**/*.js'])
Path_matcher.assert('test/test.js', ['test/**/*.js'])
Path_matcher.assert_not('test/test.js', ['test/rest/**/*.js'])
Path_matcher.assert('test/test.js', ['**/**/*.js'])
Path_matcher.assert('test/another/test.js', ['**/another/*.js'])
Path_matcher.assert_not('test/another/test.js', ['**/another_path/*.js'])
Path_matcher.assert('test/another/test.js', ['**/*/*.js'])
Path_matcher.assert('public/javascript/client.js', ['public/**'])
Path_matcher.assert('public/javascript/client.js', ['public/**/*.js'])
Path_matcher.assert('public/javascript/client.js', ['public/javascript/**/*.js'])

dev_server.start()