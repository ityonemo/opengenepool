#!/usr/bin/ruby

#packages for running the webserver
require 'rubygems'
require 'sinatra'
require 'haml'
require 'sequel'
require 'mysql2'

#distribution-dependent ruby files
require 'ogp-db' #database stuff

#code for utility pages
require './initialize' #initialization
require './userman' #user management
require './fork' #DNA forking 
require './seq' #sequence management
require './annotations' #annotations management
require './db' #database management

#code for UI pages
require './editor' #DNA editor
require './upload' #sequence data upload tool
require './workspace' #workspace xml

#enable sessions and user management
enable :sessions

#main page
get '/' do
  handleuser

  @scriptlist = []
  @csslist = ["/main.css"]
  @content = haml :main

  haml :ogp
end

get '/browse' do
  handleuser

  @scriptlist = []
  @csslist = ["/browse.css"]
  @content = haml :browse

  haml :ogp
end


