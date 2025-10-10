import { db } from "../server/db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

async function checkUserImages() {
  try {
    console.log("Checking user images in database...\n");
    
    const allUsers = await db.select({
      id: users.id,
      tgId: users.tgId,
      name: users.name,
      img: users.img,
      tgUsername: users.tgUsername
    }).from(users).limit(10);
    
    console.log(`Found ${allUsers.length} users:\n`);
    
    allUsers.forEach(user => {
      console.log(`User ID: ${user.id}`);
      console.log(`  Telegram ID: ${user.tgId}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Username: ${user.tgUsername || 'N/A'}`);
      console.log(`  Image URL: ${user.img || 'NULL'}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkUserImages();
