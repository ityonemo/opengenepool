$dblogin = "www-data"
$dbpass = ""
$dbhost = "localhost"
$dbname = "ogp"

def db_connect
  $DB=Sequel.mysql($dbname, :user => $dblogin, :password => $dbpass, :host => $dbhost)
end
