#fork.rb - runs the appropriate procedures for forking DNA sequences.
#the correct way to specify construct name is to 

require 'mysql'

def columnsfrom (db, table)
  res = db.query("SELECT COLUMN_NAME FROM information_schema.columns WHERE TABLE_NAME='#{table}';")

  #TODO: this is not the ruby way.  Can be done better.
  @columnlist = ""
    res.each do |x|
      if (x[0])
        @columnlist += x[0] + ", " unless (x[0] == 'id')
      end
    end
  @columnlist = @columnlist[0..-3]
end

post '/fork/:query' do |query|
  handleuser()

  if (session[:user])
    dbh=Mysql.real_connect("localhost","www-data","","ogp")

      #use elegant way to resolve id issue.
      res = dbh.query("CREATE TEMPORARY TABLE tseq SELECT * FROM sequences WHERE id='#{params[:sourceid]}';")
      res = dbh.query("UPDATE tseq SET owner='#{session[:user]}', title='#{query}', status='temporary', created=NOW();")
      #grab the column names
      @c1 = columnsfrom(dbh, "sequences")

      res = dbh.query("INSERT INTO sequences (#{@c1}) SELECT #{@c1} FROM tseq")
      @nid = dbh.insert_id().to_s

      #now use the same technique to transfer the annotations.
      res = dbh.query("CREATE TEMPORARY TABLE tann SELECT * FROM annotations WHERE sequence='#{params[:sourceid]}';")
      res = dbh.query("UPDATE tann SET owner='#{session[:user]}', sequence='#{@nid}', created=NOW();")
      res = dbh.query("UPDATE tann SET _id = id;") #pivot the id value to the old id.
      @c2 = columnsfrom(dbh, "annotations")

      #add all of these columns back in.
      res = dbh.query("INSERT INTO annotations (#{@c2}) SELECT #{@c2} FROM tann;")

      #modify the annotation data table.
      #rename the "id" column to be the "annotation" column in the new, joined table.
      res = dbh.query("ALTER TABLE tann CHANGE COLUMN id annotation int(64)")

      #grab any annotation data which we will need to duplicate.
      res = dbh.query("CREATE TEMPORARY TABLE tanndata SELECT * FROM annotationdata WHERE annotation IN (SELECT _id FROM tann);")
      res = dbh.query("ALTER TABLE tanndata CHANGE COLUMN annotation _id int(64)")
      @c3 = columnsfrom(dbh, "annotationdata")
      #pull the data from the joined tann2/tanndata table about the _id field.
      res = dbh.query("INSERT INTO annotationdata (#{@c3}) SELECT #{@c3} FROM tanndata, tann WHERE tanndata._id = tann._id;")

      #modify the workspaces table.
      res = dbh.query("INSERT INTO workspaces (login, sequence) VALUES ('#{session[:user]}', '#{@nid}');")

    dbh.close() if dbh
 
    "#{@nid}"
  else
    status 403.3
  end
end
