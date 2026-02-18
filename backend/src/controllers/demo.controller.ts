import { Request, Response } from 'express';
import { traceService } from '../services/traceService.js';

export const traceTransaction = async (req: Request, res: Response) => {
    try {
        const { txHash } = req.query;
        if (!txHash || typeof txHash !== 'string') {
            return res.status(400).json({ error: "txHash is required" });
        }

        const trace = await traceService.traceTransaction(txHash);

        res.status(200).json({
            status: 'success',
            data: trace
        });
    } catch (error: any) {
        console.error("Trace failed:", error);
        res.status(500).json({ status: 'error', error: error.message });
    }
};
