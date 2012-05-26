$dblogin = ENV['OPENSHIFT_DB_USERNAME']
$dbpass = ENV['OPENSHIFT_DB_PASSWORD']
$dbhost = "127.4.36.129:3306"
$dbname = ENV['OPENSHIFT_DB_USERNAME']

def db_connect
  $DB=Sequel.mysql($dbname, :user => $dblogin, :password => $dbpass, :host => $dbhost)
end
