OpenGenePool README
===================

Requires:
---------

Ruby
MySql

Following Rubygems:
-------------------

sinatra
haml
json
mysql

Recommended for developers:
---------------------------

shotgun

Usage:
------

~>  ogp.rb

With shotgun:
-------------

~> shotgun -p4567 ogp.rb

This works quite well in linux.  If you are using macOS, it should work similarly.  If you use
windows, god help you.

To test https, I suggest setting up an https-capable web forwarding server/daemon (I use NGINX)
and have it point to http://localhost:4567/, ogp is then served from https://localhost/

Getting started:
----------------

1) point your web browser to http://localhost:4567/initialize/

this will allow you to initialize the databases and set up a superuser account

2) login using the superuser

3) find test genbank files that are in the ./testfile/ directory.

4) upload them using the applet at http://localhost:4567/upload/


VERSION 0.16
============

features:
* Initialization pages.
* Upload of genbank files.
* fork() button.
* full-featured sequence selection, including unusual join()s.
* user-modified graphics settings.
* modification of annotations.
* zero, indexed gap sequence annotation.
* some workspace support.
* "nuke" button for admin reset databases.

VERSION 0.17 (Mid-April) intended milestones
* set user access and restrict functions in the interface.
* find and highlight subsequences in both forward and RC directions.
* restriction sites plugin
* find ORF plugin.
* primers plugin.
* output to genbank.

VERSION 0.2-alpha (End of April) intended milestones
* capability to edit sequences with appropriate cloning tools.
* cut-splice-stitch-gibson operation demonstration
* release on a public website
  
