import { Router } from 'express';
import { traceTransaction } from '../controllers/demo.controller.js';

const router: Router = Router();

router.get('/trace', traceTransaction);

export default router;
