$dblogin = ENV['OPENSHIFT_DB_USERNAME']
$dbpass = ENV['OPENSHIFT_DB_PASSWORD']
$dbhost = ENV['OPENSHIFT_DB_HOST']
$dbname = ENV['OPENSHIFT_APP_NAME']

def db_connect
  $DB=Sequel.mysql($dbname, :user => $dblogin, :password => $dbpass, :host => $dbhost)
end
