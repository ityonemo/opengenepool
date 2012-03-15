#!/usr/bin/ruby

#packages for running the webserver
require 'rubygems'
require 'sinatra'
require 'haml'

#code for utility pages
require 'initialize' #initialization
require 'seq' #sequence management
require 'userman' #user management

#code for UI pages
require 'editor' #DNA editor
require 'upload' #sequence data upload tool
require 'fork' #DNA forking 
require 'workspace' #workspace xml

#enable sessions and user management
enable :sessions

#main page
get '/' do
  handleuser()

  @scriptlist = []
  @csslist = ["/main.css"]
  @content = haml :main

  haml :ogp
end

get '/browse' do
  handleuser()

  @scriptlist = []
  @csslist = ["/browse.css"]
  @content = haml :browse

  haml :ogp
end

#handle the user stuff off the bat.
def handleuser()
  session[:user] ||= nil
  $user = session[:user]
  
  @logincontent = $user.nil? ? $emptylogincontent : logoutgen()
end

#HTML content for emptylogincontent.
$emptylogincontent = "<div onclick=\"activatelogin();\">Login</div>"

#generate HTML content to display current user and allow logout (kind of hack-ey).
def logoutgen ()
  return "Logged in as: " + $user + " <a href=\"logout/\" id=\"logout\"> (Logout)</a>"
end


