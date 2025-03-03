import { loadStripe } from '@stripe/stripe-js';

const stripePromise = loadStripe('pk_test_51LKy7kAlB2qwPZQ39DZ9bnVntBotA7OY7Y1OBLQeA3HjJFJ8jXtXpdhufY9eqOPmUlJaWwIkUOWmHo9FNMmPVVFu00b0qThNvt');

export default stripePromise;