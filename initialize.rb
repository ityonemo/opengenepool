get '/initialize' do
  haml :initialize
end

post '/initialize' do
  dbh=Mysql.real_connect("localhost","www-data","","ogp")
    #create the users table
    res=dbh.query("CREATE TABLE users (id int(64) NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
      "login varchar(16), name varchar(256), email varchar(64), level int(64), hash varchar(64), " +
      "UNIQUE INDEX (login), INDEX(name, email, level));")

    #add the superuser to the users table
    res=dbh.query("INSERT INTO users (login, name, email, hash, level) VALUES " +
      "('#{params[:login]}','#{params[:name]}','#{params[:email]}',SHA('#{params[:password]}'),0);")

    #create the sequences table
    res=dbh.query("CREATE TABLE sequences (id int(64) NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
      "owner varchar(16), locus varchar(64), title varchar(64), accession varchar(64), definition text, version varchar(64), keywords text, " +
      "source varchar(64), organism varchar(64), sequence text, status varchar(64), type varchar(64), class varchar(64), " +
      "created date, supercedes int(64), replacement int(64), " +
      "INDEX (owner, locus, title, accession), " +
      "FOREIGN KEY (owner) REFERENCES users(login));")

    #create the self-referential foreign keys
    res=dbh.query("ALTER TABLE sequences ADD FOREIGN KEY (supercedes) REFERENCES sequences(id);")
    res=dbh.query("ALTER TABLE sequences ADD FOREIGN KEY (replacement) REFERENCES sequences(id);")

    #create the annotations table
    res=dbh.query("CREATE TABLE annotations (id int(64) NOT NULL AUTO_INCREMENT PRIMARY KEY, " +
      "owner varchar(16), sequence int(64), caption varchar(64), type varchar(64), seqrange varchar(64), data text, " +
      "created date, supercedes int(64), replacement int(64), " +
      "INDEX (owner, sequence), FOREIGN KEY (owner) REFERENCES users(login), FOREIGN KEY (sequence) REFERENCES sequences(id));")

    #create the self-referential foreign keys
    res=dbh.query("ALTER TABLE annotations ADD FOREIGN KEY (supercedes) REFERENCES annotations(id);")
    res=dbh.query("ALTER TABLE annotations ADD FOREIGN KEY (replacement) REFERENCES annotations(id);")

    #reserved space for other tables to be created.

  dbh.close if dbh

  redirect '/'
end
