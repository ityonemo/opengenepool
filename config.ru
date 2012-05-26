require 'rubygems'
require 'mysql2'
require 'bundler'
Bundler.require
require './ogp.rb'
run Sinatra::Application
