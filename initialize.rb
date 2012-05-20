get '/initialize' do
  
  $tablecount = $DB.tables.length()
  
  haml :initialize
end

post '/initialize' do
  dbh=Mysql.real_connect($dbhost,$dblogin,$dbpass)
    if (dbh.list_tables.length() == 0)

      #create the users table
      res=dbh.query("CREATE TABLE users (id int(64) NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
        "login varchar(16), name varchar(256), email varchar(64), level int(64), hash varchar(64), " +
        "UNIQUE INDEX (login), INDEX(name, email, level));")

      #add the owner to the users table
      res=dbh.query("INSERT INTO users (login, name, email, hash, level) VALUES " +
        "('#{params[:login]}','#{params[:name]}','#{params[:email]}',SHA('#{params[:password]}'),0);")

      #create the sequences table
      res=dbh.query("CREATE TABLE sequences (id int(64) NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
        "owner varchar(16), created timestamp, supercedes int(64), status varchar(64), visibility varchar(64), " + #ogp housekeeping
        "locus varchar(64), title varchar(64), accession varchar(64), definition text, " +                       #genbank params
        "version varchar(64), keywords text, source varchar(64), organism varchar(64), sequence text, " +
        "type varchar(64), class varchar(64), " +                                                                #ogp params
        "FOREIGN KEY (owner) REFERENCES users(login));")

      #create the self-referential foreign keys
      res=dbh.query("ALTER TABLE sequences ADD FOREIGN KEY (supercedes) REFERENCES sequences(id);")

      #create the annotations table
      res=dbh.query("CREATE TABLE annotations (id int(64) NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
        "owner varchar(16), sequence int(64), created timestamp, supercedes int(64), status varchar(64), " +
        "visibility varchar(64), " + #ogp housekeeping
        "caption varchar(64), type varchar(64), domain varchar(64), " +
        "INDEX (owner, sequence), FOREIGN KEY (owner) REFERENCES users(login)," +
        "FOREIGN KEY (sequence) REFERENCES sequences(id) ON DELETE CASCADE);")

      #create the self-referential foreign keys
      res=dbh.query("ALTER TABLE annotations ADD FOREIGN KEY (supercedes) REFERENCES annotations(id);")

      #create the annotations data table
      res=dbh.query("CREATE TABLE annotationdata (id int(64) NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
        "annotation int(64), infokey varchar(64), value text, " +
        "INDEX (annotation), FOREIGN KEY (annotation) REFERENCES annotations(id) ON DELETE CASCADE);")

      #create the sources data table
      res=dbh.query("CREATE TABLE sources (id int(64) NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
        "parent int(64), child int(64), pdomain varchar(64), cdomain varchar(64), " +
        "INDEX (parent, child), FOREIGN KEY (parent) REFERENCES sequences(id) ON DELETE CASCADE, " +
        "FOREIGN KEY (child) REFERENCES sequences(id) ON DELETE CASCADE);")

      #create the workspaces data table
      res=dbh.query("CREATE TABLE workspaces (id int(64) NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
        "login varchar(64), sequence int(64), " +
        "INDEX (login, sequence), FOREIGN KEY (login) REFERENCES users(login) ON DELETE CASCADE, " +
        "FOREIGN KEY (sequence) REFERENCES sequences(id) ON DELETE CASCADE);")
      
    end
  dbh.close if dbh

  redirect '/'
end

get '/nuke' do
  if (amisuperuser)
  dbh=Mysql.real_connect($dbhost,$dblogin,$dbpass, $dbname)

      #delete the users table
      res=dbh.query("DROP TABLE users")
      #delete the sequences table
      res=dbh.query("DROP TABLE sequences")
      #delete the annotations table
      res=dbh.query("DROP TABLE annotations")
      #delete the annotations data table
      res=dbh.query("DROP TABLE annotationdata")
      #delete the sources data table
      res=dbh.query("DROP TABLE sources")
      #delete the workspaces data table
      res=dbh.query("DROP TABLE workspaces")

    dbh.close if dbh

    "the database has been nuked."
  else
    403
  end
end
