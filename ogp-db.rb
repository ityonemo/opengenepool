$dblogin = ENV['OPENSHIFT_DB_USERNAME']
$dbpass = ENV['OPENSHIFT_DB_PASSWORD']
$dbhost = 'opengenepool-indysci.rhcloud.com'
$dbname = ENV['OPENSHIFT_DB_USERNAME']

def db_connect
  $DB=Sequel.mysql($dbname, :user => $dblogin, :password => $dbpass, :host => $dbhost)
end
