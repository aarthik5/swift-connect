
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY must be set in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const USER_B_EMAIL = 'user_b_simulation@example.com';
const USER_B_PASSWORD = 'password123';
const USER_B_USERNAME = 'Simulation_User';

async function main() {
    console.log('--- Starting User B Simulation ---');

    // 1. Sign Up / Sign In User B
    console.log(`Attempting to sign in as ${USER_B_EMAIL}...`);
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: USER_B_EMAIL,
        password: USER_B_PASSWORD,
    });

    if (authError) {
        if (authError.message.includes('Invalid login credentials')) {
            console.log('User not found, attempting to sign up...');
            // Sign up if not exists
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: USER_B_EMAIL,
                password: USER_B_PASSWORD,
                options: {
                    data: {
                        username: USER_B_USERNAME
                    }
                }
            });

            if (signUpError) {
                console.error('Failed to sign up User B:', signUpError.message);
                return;
            }

            console.log('User B signed up successfully.');

            // Wait a bit for the trigger to create the profile
            await new Promise(r => setTimeout(r, 2000));

            authData = signUpData;
        } else {
            console.error('Failed to sign in User B:', authError.message);
            return;
        }
    } else {
        console.log('User B signed in successfully.');
    }

    const userBId = authData.session?.user.id;
    if (!userBId) {
        console.error('Could not get User B ID.');
        return;
    }

    // Set online status
    await supabase
        .from("profiles")
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq("user_id", userBId);

    console.log(`User B (${USER_B_USERNAME}) is now ONLINE.`);

    // 2. Subscribe to Messages
    console.log('Listening for incoming messages...');

    const channel = supabase
        .channel('public:messages')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `conversation_id=neq.null`, // Listen to all inserts, filter logic in callback
            },
            async (payload) => {
                const newMessage = payload.new;

                // Only reply if the message is NOT from User B
                if (newMessage.sender_id !== userBId) {
                    console.log(`Received message: "${newMessage.content}" from ${newMessage.sender_id}`);

                    // Mark as read
                    await supabase
                        .from("messages")
                        .update({ is_read: true })
                        .eq("id", newMessage.id);

                    // Wait a second to simulate typing
                    await new Promise(r => setTimeout(r, 1500));

                    // Send Reply
                    const replyContent = `Echo: ${newMessage.content}`;
                    const { error: sendError } = await supabase
                        .from("messages")
                        .insert({
                            conversation_id: newMessage.conversation_id,
                            sender_id: userBId,
                            content: replyContent,
                            is_delivered: true
                        });

                    if (sendError) {
                        console.error('Error sending reply:', sendError.message);
                    } else {
                        console.log(`Sent reply: "${replyContent}"`);
                    }
                }
            }
        )
        .subscribe();

    // Keep script running
    process.stdin.resume();

    // Handle cleanup
    process.on('SIGINT', async () => {
        console.log('\nLogging out User B...');
        await supabase
            .from("profiles")
            .update({ is_online: false, last_seen: new Date().toISOString() })
            .eq("user_id", userBId);
        process.exit();
    });
}

main();
