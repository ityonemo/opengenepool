#fork.rb - runs the appropriate procedures for forking DNA sequences.
#the correct way to specify construct name is to 

require 'mysql'

def columnsfrom (db, table)
  res = db.query("SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_NAME='#{table}';")

  #TODO: this is not the ruby way.  Can be done better.
  @columnlist = "("
    res.each do |x|
      if (x[0])
        @columnlist += x[0] + ", " unless (x[0] == 'id')
      end
    end
  @columnlist = @columnlist[0..-3] + ")"
end

post '/fork/:query' do |query|
  handleuser()

  if (session[:user])
    dbh=Mysql.real_connect("localhost","www-data","","ogp")

      #use elegant way to resolve id issue.
      res = dbh.query("CREATE TEMPORARY TABLE tseq SELECT * FROM sequences WHERE id='#{params[:sourceid]}';")
      res = dbh.query("UPDATE tseq SET owner='#{session[:user]}', title='#{query}', status='virtual', created=NOW();")
      res = dbh.query("ALTER TABLE tseq DROP id")
      #grab the column names
      @c1 = columnsfrom(dbh, "sequences")

      res = dbh.query("INSERT INTO sequences #{@c1} SELECT * FROM tseq")
      @nid = dbh.insert_id().to_s

      #now use the same technique to transfer the annotations.
      res = dbh.query("CREATE TEMPORARY TABLE tann SELECT * FROM annotations WHERE sequence='#{params[:sourceid]}';")
      res = dbh.query("UPDATE tann SET owner='#{session[:user]}', sequence='#{@nid}', created=NOW();")
      res = dbh.query("ALTER TABLE tann DROP id")
      @c2 = columnsfrom(dbh, "annotations")

      #add all of these columns back in.
      res = dbh.query("INSERT INTO annotations #{@c2} SELECT * FROM tann")

      #modify the sources table.

      #modify the workspaces table.
      res = dbh.query("INSERT INTO workspaces (login, sequence) VALUES '#{session[:user]}', '#{@nid}'")

    dbh.close() if dbh
 
    "#{@nid}"
  else
    status 403.3
  end
end
