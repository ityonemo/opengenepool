#!/usr/bin/ruby

#packages for running the webserver
require 'rubygems'
require 'sinatra'
require 'haml'

#code for non-main pages
require 'userman' #user management
require 'content' #HTML content/xml management
require 'editor' #DNA editor
require 'seq' #sequence management

#enable sessions and user management
enable :sessions

#main page
get '/' do
  handleuser()

  @scriptlist = []
  @csslist = ["main.css"]
  @content = haml :main

  haml :ogp
end

get '/browse' do
  handleuser()

  @scriptlist = []
  @csslist = ["browse.css"]
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


